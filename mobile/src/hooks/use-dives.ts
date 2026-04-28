import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import type { Dive, Weather } from "@/src/types/dive";

type DiveRow = {
  id: string;
  user_id: string;
  dive_number: number;
  country: string;
  location: string;
  point: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  max_depth: number | string;
  avg_depth: number | string | null;
  water_temp: number | string | null;
  visibility: number | null;
  weather: string | null;
  memo: string | null;
  is_verified: boolean;
  device_serial: string | null;
  raw_binary_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
};

const WEATHER_MAP: Record<string, Weather> = {
  sunny: "맑음",
  cloudy: "구름",
  rainy: "비",
  night: "밤",
};

const toNumber = (v: number | string | null): number => {
  if (v === null) return 0;
  return typeof v === "number" ? v : Number(v);
};

const mapDive = (row: DiveRow): Dive => ({
  id: row.id,
  userId: row.user_id,
  diveNumber: row.dive_number,
  country: row.country,
  location: row.location,
  point: row.point ?? "",
  startedAt: row.started_at,
  endedAt: row.ended_at,
  maxDepth: toNumber(row.max_depth),
  avgDepth: toNumber(row.avg_depth),
  durationMinutes: row.duration_minutes,
  waterTemp: toNumber(row.water_temp),
  visibility: row.visibility ?? 0,
  weather: WEATHER_MAP[row.weather ?? "sunny"] ?? "맑음",
  memo: row.memo,
  isVerified: row.is_verified,
  deviceSerial: row.device_serial,
  rawBinaryUrl: row.raw_binary_url,
  thumbnailUrl: row.thumbnail_url,
  createdAt: row.created_at,
});

export function useDives(userId: string | undefined) {
  return useQuery({
    queryKey: ["dives", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Dive[]> => {
      const { data, error } = await supabase
        .from("dives")
        .select("*")
        .eq("user_id", userId!)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as DiveRow[]).map(mapDive);
    },
  });
}

export function useDive(diveId: string | undefined) {
  return useQuery({
    queryKey: ["dive", diveId],
    enabled: !!diveId,
    queryFn: async (): Promise<Dive | null> => {
      const { data, error } = await supabase
        .from("dives")
        .select("*")
        .eq("id", diveId!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapDive(data as unknown as DiveRow) : null;
    },
  });
}
