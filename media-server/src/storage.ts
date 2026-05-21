import { mkdir, stat, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, dirname, normalize, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform, type Readable } from "node:stream";
import { config } from "./config.js";

// Allowed top-level folders. Each represents a different kind of media.
//  - dives: per-dive photos/videos uploaded by owner
//  - avatars: user profile pictures (one folder per user)
//  - feeds: feed post images (one folder per user)
//  - teams: team profile pictures (one folder per team)
//  - certifications: C-card photos (one folder per user; multiple cards)
//  - boards: community board post media (one folder per user; multiple posts)
export const ALLOWED_KINDS = [
  "dives",
  "avatars",
  "feeds",
  "teams",
  "certifications",
  "boards",
] as const;
export type MediaKind = (typeof ALLOWED_KINDS)[number];

export function isMediaKind(s: string): s is MediaKind {
  return (ALLOWED_KINDS as readonly string[]).includes(s);
}

// Resolve a safe absolute path under STORAGE_ROOT. Throws on path traversal.
function safePath(...parts: string[]): string {
  const joined = normalize(join(...parts));
  const abs = resolve(config.storageRoot, joined);
  const root = resolve(config.storageRoot);
  if (!abs.startsWith(root + "/") && abs !== root) {
    throw new Error("Path traversal detected");
  }
  return abs;
}

export function mediaPath(
  kind: MediaKind,
  scopeId: string,
  filename: string,
): string {
  return safePath(kind, scopeId, filename);
}

// Backward-compat alias used by existing dive flows.
export function diveMediaPath(diveId: string, filename: string): string {
  return mediaPath("dives", diveId, filename);
}

export async function streamToFile(
  stream: Readable,
  kind: MediaKind,
  scopeId: string,
  filename: string,
): Promise<{ path: string; sizeBytes: number }> {
  const target = mediaPath(kind, scopeId, filename);
  await mkdir(dirname(target), { recursive: true });

  let bytes = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length;
      if (bytes > config.maxUploadBytes) {
        return cb(new Error("File exceeds MAX_UPLOAD_BYTES"));
      }
      cb(null, chunk);
    },
  });

  await pipeline(stream, counter, createWriteStream(target));
  const s = await stat(target);
  return { path: target, sizeBytes: s.size };
}

export async function deleteFile(
  kind: MediaKind,
  scopeId: string,
  filename: string,
): Promise<void> {
  const target = mediaPath(kind, scopeId, filename);
  await unlink(target);
}

export function publicMediaUrl(
  kind: MediaKind,
  scopeId: string,
  filename: string,
): string {
  return `${config.publicBaseUrl}/file/${kind}/${encodeURIComponent(scopeId)}/${encodeURIComponent(filename)}`;
}

// Backward-compat alias.
export function publicUrl(diveId: string, filename: string): string {
  return publicMediaUrl("dives", diveId, filename);
}
