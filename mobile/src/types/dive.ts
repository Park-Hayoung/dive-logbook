export type Weather = "맑음" | "구름" | "비" | "밤";

export type EntryType = "boat" | "shore" | "liveaboard";
export type CurrentStrength = "none" | "mild" | "moderate" | "strong";
export type WaterType = "fresh" | "salt";

export type Dive = {
  id: string;
  userId: string;
  diveNumber: number;
  country: string;
  location: string;
  point: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
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
  // BLE / 다이브 조건 필드 (003 마이그레이션)
  diveMode: string | null;
  entryType: EntryType | null;
  diveStyle: string[] | null;
  currentStrength: CurrentStrength | null;
  surfaceIntervalMin: number | null;
  gfLow: number | null;
  gfHigh: number | null;
  decoModel: string | null;
  atmosphericMbar: number | null;
  waterType: WaterType | null;
  tankStartBar: number | null;
  tankEndBar: number | null;
  tankVolumeL: number | null;
  tankSerial: string | null;
  consumptionBarPerMin: number | null;
  sacLPerMin: number | null;
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
