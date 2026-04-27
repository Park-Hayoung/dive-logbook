export type MediaProvider =
  | "synology"
  | "cloudflare-r2"
  | "cloudflare-stream"
  | "supabase";

export type MediaKind = "image" | "video";

export type UploadResult = {
  url: string;
  provider: MediaProvider;
  filename: string;
  sizeBytes: number;
};

export type UploadInput = {
  diveId: string;
  localUri: string;
  originalFilename: string;
  contentType: string;
  kind: MediaKind;
};

export interface MediaStorage {
  readonly provider: MediaProvider;
  upload(input: UploadInput): Promise<UploadResult>;
  delete(filename: string, diveId: string): Promise<void>;
}
