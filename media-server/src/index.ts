import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

import { config } from "./config.js";
import {
  verifySupabaseJwt,
  signUploadPayload,
  verifyUploadSignature,
} from "./auth.js";
import {
  streamToFile,
  deleteFile,
  publicMediaUrl,
  mediaPath,
  isMediaKind,
  type MediaKind,
} from "./storage.js";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
};

function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

const app = new Hono();
app.use("*", logger());
app.use("*", cors({ origin: "*" }));

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get("/", (c) => c.json({ ok: true, service: "divelog-media-server" }));
app.get("/health", (c) => c.json({ ok: true }));

// ---------------------------------------------------------------------------
// 1) Mobile app requests an upload URL.
//    Auth: Supabase JWT in Authorization: Bearer ...
//    Body: { kind, diveId?, teamId?, originalFilename, contentType }
//      kind ∈ "dives" | "avatars" | "feeds" | "teams"  (default: "dives")
//      - dives:   diveId required; scope is the dive
//      - teams:   teamId required; scope is the team
//      - avatars: scope is the authenticated user (auto)
//      - feeds:   scope is the authenticated user (auto)
//    Returns: { uploadUrl, finalUrl, filename, expiresAt }
// ---------------------------------------------------------------------------
app.post("/upload-token", async (c) => {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Missing bearer token" }, 401);
  }
  let claims;
  try {
    claims = await verifySupabaseJwt(auth.slice(7));
  } catch (e) {
    return c.json({ error: "Invalid JWT", detail: String(e) }, 401);
  }

  const body = await c.req.json().catch(() => null);
  if (!body?.originalFilename) {
    return c.json({ error: "originalFilename required" }, 400);
  }

  const rawKind = (body.kind ?? "dives") as string;
  if (!isMediaKind(rawKind)) {
    return c.json({ error: `Invalid kind: ${rawKind}` }, 400);
  }
  const kind: MediaKind = rawKind;

  let scopeId: string;
  if (kind === "dives") {
    if (!body.diveId) return c.json({ error: "diveId required for dives" }, 400);
    scopeId = String(body.diveId);
  } else if (kind === "teams") {
    if (!body.teamId) return c.json({ error: "teamId required for teams" }, 400);
    scopeId = String(body.teamId);
  } else {
    // avatars / feeds: always scoped to the authenticated user.
    scopeId = claims.sub;
  }

  // Generate server-side filename: <uuid>.<ext> — never trust client name verbatim
  const ext = extname(body.originalFilename).toLowerCase().slice(0, 10) || "";
  const filename = `${randomUUID()}${ext}`;
  const scopePath = `${kind}/${scopeId}`;
  const expiresAt = Date.now() + config.uploadUrlTtlSeconds * 1000;
  const signature = signUploadPayload(
    claims.sub,
    scopePath,
    filename,
    expiresAt,
  );

  const uploadUrl =
    `${config.publicBaseUrl}/upload/${claims.sub}/${kind}/${encodeURIComponent(scopeId)}/${encodeURIComponent(filename)}` +
    `?exp=${expiresAt}&sig=${signature}`;

  return c.json({
    uploadUrl,
    finalUrl: publicMediaUrl(kind, scopeId, filename),
    filename,
    expiresAt,
  });
});

// ---------------------------------------------------------------------------
// 2) Client streams the file with HTTP PUT to the signed URL.
//    Path: /upload/:userId/:kind/:scopeId/:filename
// ---------------------------------------------------------------------------
app.put("/upload/:userId/:kind/:scopeId/:filename", async (c) => {
  const { userId, kind, scopeId, filename } = c.req.param();
  if (!isMediaKind(kind)) {
    return c.json({ error: `Invalid kind: ${kind}` }, 400);
  }
  const exp = Number(c.req.query("exp"));
  const sig = c.req.query("sig");
  if (!exp || !sig) return c.json({ error: "Missing exp/sig" }, 400);

  const scopePath = `${kind}/${scopeId}`;
  if (!verifyUploadSignature(sig, userId, scopePath, filename, exp)) {
    return c.json({ error: "Invalid or expired signature" }, 403);
  }

  const body = c.req.raw.body;
  if (!body) return c.json({ error: "Empty body" }, 400);

  // Convert WHATWG ReadableStream to Node Readable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeStream = Readable.fromWeb(body as any);

  try {
    const { sizeBytes } = await streamToFile(
      nodeStream,
      kind,
      scopeId,
      filename,
    );
    return c.json({
      ok: true,
      url: publicMediaUrl(kind, scopeId, filename),
      sizeBytes,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[upload] streamToFile failed:", {
      kind,
      scopeId,
      filename,
      error: e instanceof Error ? { message: e.message, stack: e.stack } : e,
    });
    return c.json({ error: "Upload failed", detail: String(e) }, 500);
  }
});

// ---------------------------------------------------------------------------
// 3) Public read — Cloudflare CDN caches these.
// ---------------------------------------------------------------------------
app.get("/file/:kind/:scopeId/:filename", async (c) => {
  const { kind, scopeId, filename } = c.req.param();
  if (!isMediaKind(kind)) {
    return c.json({ error: `Invalid kind: ${kind}` }, 400);
  }

  let absPath: string;
  try {
    absPath = mediaPath(kind, scopeId, filename);
  } catch {
    return c.json({ error: "Invalid path" }, 400);
  }

  let stats;
  try {
    stats = await stat(absPath);
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
  if (!stats.isFile()) return c.json({ error: "Not found" }, 404);

  const stream = createReadStream(absPath);
  const webStream = Readable.toWeb(stream) as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": mimeFromFilename(filename),
      "Content-Length": String(stats.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

// ---------------------------------------------------------------------------
// 4) Delete (auth required, owner verified via JWT)
//    Note: callers should DELETE the related DB row first; this endpoint just
//    removes the file from disk.
// ---------------------------------------------------------------------------
app.delete("/file/:kind/:scopeId/:filename", async (c) => {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
  try {
    await verifySupabaseJwt(auth.slice(7));
  } catch {
    return c.json({ error: "Invalid JWT" }, 401);
  }
  const { kind, scopeId, filename } = c.req.param();
  if (!isMediaKind(kind)) {
    return c.json({ error: `Invalid kind: ${kind}` }, 400);
  }
  try {
    mediaPath(kind, scopeId, filename); // path traversal check
    await deleteFile(kind, scopeId, filename);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: "Delete failed", detail: String(e) }, 500);
  }
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`media-server listening on :${info.port}`);
});
