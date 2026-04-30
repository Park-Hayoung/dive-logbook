import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import type { Dive, Weather } from "@/src/types/dive";

type DiveRow = {
  id: string;
  user_id: string;
  dive_number: number;
  country: string;
  location: string;
  point: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
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
  lat: row.lat,
  lng: row.lng,
  placeId: row.place_id,
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

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export type UpdateDiveInput = {
  country: string;
  location: string;
  point: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  startedAt: string;
  endedAt: string;
  maxDepth: number;
  avgDepth: number | null;
  waterTemp: number | null;
  visibility: number | null;
  weather: "sunny" | "cloudy" | "rainy" | "night";
  memo: string | null;
  // 사용자 보유 장비 ID 배열 — 전체 교체 (delete + insert).
  userEquipmentIds: string[];
};

export function useUpdateDive(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { diveId: string; patch: UpdateDiveInput }) => {
      if (!userId) throw new Error("로그인이 필요해요.");
      const { diveId, patch } = args;

      const { error } = await supabase
        .from("dives")
        .update({
          country: patch.country,
          location: patch.location,
          point: patch.point,
          lat: patch.lat,
          lng: patch.lng,
          place_id: patch.placeId,
          started_at: patch.startedAt,
          ended_at: patch.endedAt,
          max_depth: patch.maxDepth,
          avg_depth: patch.avgDepth,
          water_temp: patch.waterTemp,
          visibility: patch.visibility,
          weather: patch.weather,
          memo: patch.memo,
        })
        .eq("id", diveId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message || JSON.stringify(error));

      // 장비 링크 전체 교체. 기존 링크를 모두 삭제하고 새로 삽입.
      const { error: delErr } = await supabase
        .from("dive_user_equipment")
        .delete()
        .eq("dive_id", diveId);
      if (delErr) throw new Error(delErr.message || JSON.stringify(delErr));

      if (patch.userEquipmentIds.length > 0) {
        const links = patch.userEquipmentIds.map((eqId) => ({
          dive_id: diveId,
          user_equipment_id: eqId,
        }));
        const { error: insErr } = await supabase
          .from("dive_user_equipment")
          .insert(links);
        if (insErr) throw new Error(insErr.message || JSON.stringify(insErr));
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["dives", userId] });
      qc.invalidateQueries({ queryKey: ["dive", vars.diveId] });
      qc.invalidateQueries({ queryKey: ["dive-user-equipment", vars.diveId] });
    },
  });
}

// dive_media 의 storage_url 에서 NAS/Supabase 경로를 추출해 삭제까지 시도.
// 실패해도 DB 행은 cascade 로 정리되므로 전체 삭제는 진행.
async function removeDiveMediaFiles(diveId: string): Promise<void> {
  const { data } = await supabase
    .from("dive_media")
    .select("storage_url, provider")
    .eq("dive_id", diveId);

  const rows = ((data ?? []) as unknown as {
    storage_url: string;
    provider: string | null;
  }[]);

  // Supabase Storage(public bucket) 만 클라이언트에서 정리. NAS/Cloudflare 는 서버 사이드에서
  // orphan cleanup 잡으로 처리 — 클라이언트는 토큰 권한이 없을 수 있다.
  const supabasePaths: string[] = [];
  for (const r of rows) {
    if (!r.storage_url) continue;
    const marker = "/storage/v1/object/public/dive-media/";
    const idx = r.storage_url.indexOf(marker);
    if (idx >= 0) {
      supabasePaths.push(r.storage_url.slice(idx + marker.length));
    }
  }
  if (supabasePaths.length > 0) {
    await supabase.storage.from("dive-media").remove(supabasePaths);
  }
}

export function useDeleteDive(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (diveId: string) => {
      if (!userId) throw new Error("로그인이 필요해요.");

      // Storage 파일 정리 (cascade 로 dive_media row 는 자동 삭제되지만 파일 자체는 남는다)
      try {
        await removeDiveMediaFiles(diveId);
      } catch {
        // 파일 정리 실패해도 DB 삭제는 진행 — orphan cleanup job 이 처리
      }

      const { error } = await supabase
        .from("dives")
        .delete()
        .eq("id", diveId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: (_data, diveId) => {
      qc.invalidateQueries({ queryKey: ["dives", userId] });
      qc.removeQueries({ queryKey: ["dive", diveId] });
    },
  });
}

// 다이브에 연결된 사용자 보유 장비 ID 목록 (수정 화면 프리필용).
export function useDiveUserEquipment(diveId: string | undefined) {
  return useQuery({
    queryKey: ["dive-user-equipment", diveId],
    enabled: !!diveId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("dive_user_equipment")
        .select("user_equipment_id")
        .eq("dive_id", diveId!);
      if (error) throw new Error(error.message || JSON.stringify(error));
      return ((data ?? []) as unknown as { user_equipment_id: string }[]).map(
        (r) => r.user_equipment_id,
      );
    },
  });
}

// 다이브 상세 화면용 — 장비 + 카탈로그 join 까지 한 번에 가져온다.
export type DiveEquipmentItem = {
  id: string;
  category: string;
  brand: string;
  model: string;
};

export function useDiveEquipmentDetails(diveId: string | undefined) {
  return useQuery({
    queryKey: ["dive-equipment-details", diveId],
    enabled: !!diveId,
    queryFn: async (): Promise<DiveEquipmentItem[]> => {
      const { data, error } = await supabase
        .from("dive_user_equipment")
        .select(
          `user_equipment:user_equipment_id(
             id, category, custom_brand, custom_model,
             catalog:equipment!equipment_id(brand, brand_en, model)
           )`,
        )
        .eq("dive_id", diveId!);
      if (error) throw new Error(error.message || JSON.stringify(error));

      type Row = {
        user_equipment: {
          id: string;
          category: string;
          custom_brand: string | null;
          custom_model: string | null;
          catalog: {
            brand: string | null;
            brand_en: string | null;
            model: string;
          } | null;
        } | null;
      };

      const rows = ((data ?? []) as unknown as Row[])
        .map((r) => r.user_equipment)
        .filter((eq): eq is NonNullable<Row["user_equipment"]> => !!eq);

      return rows.map((eq) => {
        const brand = eq.catalog?.brand ?? eq.custom_brand ?? "—";
        const model = eq.catalog?.model ?? eq.custom_model ?? "—";
        return { id: eq.id, category: eq.category, brand, model };
      });
    },
  });
}
