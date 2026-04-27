import type { MediaStorage } from "./types";

// Placeholder for future Cloudflare R2 / Stream backend.
// Implement when Synology NAS hits scale limits (~100+ users).
export const cloudflareR2Storage: MediaStorage = {
  provider: "cloudflare-r2",
  async upload() {
    throw new Error("Cloudflare R2 storage not yet implemented");
  },
  async delete() {
    throw new Error("Cloudflare R2 storage not yet implemented");
  },
};
