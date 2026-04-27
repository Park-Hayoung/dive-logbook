export type Weather = "맑음" | "구름" | "비" | "밤";

export type Dive = {
  id: string;
  userId: string;
  diveNumber: number;
  country: string;
  location: string;
  point: string;
  startedAt: string;
  endedAt: string;
  maxDepth: number;
  avgDepth: number;
  durationMinutes: number;
  waterTemp: number;
  visibility: number;
  weather: Weather;
  memo: string | null;
  isVerified: boolean;
  deviceSerial: string | null;
  rawBinaryUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
};

export type DiveBuddy = { diveId: string; userId: string };
export type DiveEquipment = { diveId: string; equipmentId: string };

export type MediaProvider =
  | "synology"
  | "cloudflare-r2"
  | "cloudflare-stream"
  | "supabase";

export type DiveMedia = {
  id: string;
  diveId: string;
  storageUrl: string;
  kind: "image" | "video";
  provider: MediaProvider;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  originalFilename: string | null;
  width: number | null;
  height: number | null;
  uploadedAt: string;
};
