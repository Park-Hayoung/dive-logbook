import { mkdir, stat, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, dirname, normalize, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { config } from "./config.js";

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

export function diveMediaPath(diveId: string, filename: string): string {
  return safePath("dives", diveId, filename);
}

export async function streamToFile(
  stream: Readable,
  diveId: string,
  filename: string,
): Promise<{ path: string; sizeBytes: number }> {
  const target = diveMediaPath(diveId, filename);
  await mkdir(dirname(target), { recursive: true });

  let bytes = 0;
  const counter = new (await import("node:stream")).Transform({
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

export async function deleteFile(diveId: string, filename: string): Promise<void> {
  const target = diveMediaPath(diveId, filename);
  await unlink(target);
}

export function publicUrl(diveId: string, filename: string): string {
  return `${config.publicBaseUrl}/file/dives/${encodeURIComponent(diveId)}/${encodeURIComponent(filename)}`;
}
