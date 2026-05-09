export type MediaProvider =
  | "synology"
  | "cloudflare-r2"
  | "cloudflare-stream"
  | "supabase";

export type MediaKind = "image" | "video";

// Where the file lives on the storage backend. Mirrors the server-side
// `kind/scopeId` layout.
export type UploadScope =
  | { type: "dive"; diveId: string }
  | { type: "avatar" } // user-scoped automatically
  | { type: "feed" } // user-scoped automatically
  | { type: "team"; teamId: string }
  | { type: "certification" }; // user-scoped automatically (C-card photos)

export type UploadResult = {
  url: string;
  provider: MediaProvider;
  filename: string;
  sizeBytes: number;
};

export type UploadInput = {
  scope: UploadScope;
  localUri: string;
  originalFilename: string;
  contentType: string;
  /** image|video — only relevant for dive media (stored in dive_media.kind). */
  kind?: MediaKind;
};

export interface MediaStorage {
  readonly provider: MediaProvider;
  upload(input: UploadInput): Promise<UploadResult>;
  /** Delete a file by its scope + filename. */
  delete(scope: UploadScope, filename: string): Promise<void>;
}
