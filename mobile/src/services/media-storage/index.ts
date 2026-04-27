import { synologyStorage } from "./synology";
import { cloudflareR2Storage } from "./cloudflare-r2";
import type { MediaStorage, MediaProvider } from "./types";

export type { MediaStorage, MediaProvider, UploadInput, UploadResult, MediaKind } from "./types";

const PROVIDER = (process.env.EXPO_PUBLIC_MEDIA_PROVIDER ??
  "synology") as MediaProvider;

const registry: Record<MediaProvider, MediaStorage> = {
  synology: synologyStorage,
  "cloudflare-r2": cloudflareR2Storage,
  "cloudflare-stream": cloudflareR2Storage, // TODO: split when implementing
  supabase: synologyStorage, // legacy fallback — only old rows
};

export const mediaStorage: MediaStorage = registry[PROVIDER] ?? synologyStorage;

export function getStorageFor(provider: MediaProvider): MediaStorage {
  return registry[provider];
}
