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
  publicUrl,
  diveMediaPath,
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
//    Body: { diveId, originalFilename, contentType }
//    Returns: { uploadUrl, expiresAt, finalUrl }
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
  if (!body?.diveId || !body?.originalFilename) {
    return c.json({ error: "diveId and originalFilename required" }, 400);
  }

  // Generate server-side filename: <uuid>.<ext> — never trust client name verbatim
  const ext = extname(body.originalFilename).toLowerCase().slice(0, 10) || "";
  const filename = `${randomUUID()}${ext}`;
  const expiresAt = Date.now() + config.uploadUrlTtlSeconds * 1000;
  const signature = signUploadPayload(claims.sub, body.diveId, filename, expiresAt);

  const uploadUrl =
    `${config.publicBaseUrl}/upload/${claims.sub}/${body.diveId}/${filename}` +
    `?exp=${expiresAt}&sig=${signature}`;

  return c.json({
    uploadUrl,
    finalUrl: publicUrl(body.diveId, filename),
    filename,
    expiresAt,
  });
});

// ---------------------------------------------------------------------------
// 2) Client streams the file with HTTP PUT to the signed URL.
// ---------------------------------------------------------------------------
app.put("/upload/:userId/:diveId/:filename", async (c) => {
  const { userId, diveId, filename } = c.req.param();
  const exp = Number(c.req.query("exp"));
  const sig = c.req.query("sig");
  if (!exp || !sig) return c.json({ error: "Missing exp/sig" }, 400);
  if (!verifyUploadSignature(sig, userId, diveId, filename, exp)) {
    return c.json({ error: "Invalid or expired signature" }, 403);
  }

  const body = c.req.raw.body;
  if (!body) return c.json({ error: "Empty body" }, 400);

  // Convert WHATWG ReadableStream to Node Readable
  const { Readable } = await import("node:stream");
  const nodeStream = Readable.fromWeb(body as any);

  try {
    const { sizeBytes } = await streamToFile(nodeStream, diveId, filename);
    return c.json({
      ok: true,
      url: publicUrl(diveId, filename),
      sizeBytes,
    });
  } catch (e) {
    return c.json({ error: "Upload failed", detail: String(e) }, 500);
  }
});

// ---------------------------------------------------------------------------
// 3) Public read — Cloudflare CDN caches these.
//    Manual streaming handler (Hono's serveStatic + absolute root + rewrite is
//    fragile across versions; this is portable and explicit).
// ---------------------------------------------------------------------------
app.get("/file/dives/:diveId/:filename", async (c) => {
  const { diveId, filename } = c.req.param();
  let absPath: string;
  try {
    absPath = diveMediaPath(diveId, filename);
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
// ---------------------------------------------------------------------------
app.delete("/file/dives/:diveId/:filename", async (c) => {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
  try {
    await verifySupabaseJwt(auth.slice(7));
  } catch {
    return c.json({ error: "Invalid JWT" }, 401);
  }
  const { diveId, filename } = c.req.param();
  // Verify the file belongs to a dive owned by this user via Supabase RLS check
  // is delegated to the mobile client (it must DELETE the dive_media row first).
  // Here we just remove the file.
  diveMediaPath(diveId, filename); // throws if path traversal
  try {
    await deleteFile(diveId, filename);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: "Delete failed", detail: String(e) }, 500);
  }
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`media-server listening on :${info.port}`);
});
