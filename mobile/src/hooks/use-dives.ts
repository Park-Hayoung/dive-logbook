import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import type { TablesUpdate } from "@/src/types/database";
import type {
  Dive,
  Weather,
  EntryType,
  CurrentStrength,
  WaterType,
} from "@/src/types/dive";

type DiveRow = {
  id: string;
  user_id: string;
  dive_number: number;
  country: string;
  location: string;
  point: string | null;
  lat: number | string | null;
  lng: number | string | null;
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
  dive_mode: string | null;
  entry_type: string | null;
  dive_style: string[] | null;
  current_strength: string | null;
  surface_interval_min: number | null;
  gf_low: number | null;
  gf_high: number | null;
  deco_model: string | null;
  atmospheric_mbar: number | null;
  water_type: string | null;
  tank_start_bar: number | string | null;
  tank_end_bar: number | string | null;
  tank_volume_l: number | string | null;
  tank_serial: string | null;
  consumption_bar_per_min: number | string | null;
  sac_l_per_min: number | string | null;
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

const numOrNull = (v: number | string | null): number | null =>
  v === null ? null : typeof v === "number" ? v : Number(v);

const mapDive = (row: DiveRow): Dive => ({
  id: row.id,
  userId: row.user_id,
  diveNumber: row.dive_number,
  country: row.country,
  location: row.location,
  point: row.point ?? "",
  lat: numOrNull(row.lat),
  lng: numOrNull(row.lng),
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
  diveMode: row.dive_mode,
  entryType: (row.entry_type as EntryType | null) ?? null,
  diveStyle: row.dive_style,
  currentStrength: (row.current_strength as CurrentStrength | null) ?? null,
  surfaceIntervalMin: row.surface_interval_min,
  gfLow: row.gf_low,
  gfHigh: row.gf_high,
  decoModel: row.deco_model,
  atmosphericMbar: row.atmospheric_mbar,
  waterType: (row.water_type as WaterType | null) ?? null,
  tankStartBar: numOrNull(row.tank_start_bar),
  tankEndBar: numOrNull(row.tank_end_bar),
  tankVolumeL: numOrNull(row.tank_volume_l),
  tankSerial: row.tank_serial,
  consumptionBarPerMin: numOrNull(row.consumption_bar_per_min),
  sacLPerMin: numOrNull(row.sac_l_per_min),
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
  // Always user-editable
  country: string;
  location: string;
  point: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  visibility: number | null;
  weather: "sunny" | "cloudy" | "rainy" | "night";
  memo: string | null;
  // entryType / diveStyle 은 UI 에서 제거됐지만 기존 데이터는 보존 — 호출자가 명시적으로
  // 보낼 때만 덮어쓴다 (undefined 면 컬럼 미터치).
  entryType?: EntryType | null;
  diveStyle?: string[] | null;
  currentStrength: CurrentStrength | null;
  surfaceIntervalMin: number | null;
  tankVolumeL: number | null;
  // 사용자 보유 장비 ID 배열 — 전체 교체 (delete + insert).
  userEquipmentIds: string[];
  // 함께한 버디 user_id 배열 — 전체 교체 (delete + insert).
  buddyUserIds: string[];
  // BLE-locked fields. Caller omits these when is_verified=true so they can't
  // be tampered with. The server-side trigger (012) is the authoritative gate.
  startedAt?: string;
  endedAt?: string;
  maxDepth?: number;
  avgDepth?: number | null;
  waterTemp?: number | null;
  tankStartBar?: number | null;
  tankEndBar?: number | null;
};

export function useUpdateDive(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { diveId: string; patch: UpdateDiveInput }) => {
      if (!userId) throw new Error("로그인이 필요해요.");
      const { diveId, patch } = args;

      const updateRow: TablesUpdate<"dives"> = {
        country: patch.country,
        location: patch.location,
        point: patch.point,
        lat: patch.lat,
        lng: patch.lng,
        place_id: patch.placeId,
        visibility: patch.visibility,
        weather: patch.weather,
        memo: patch.memo,
        current_strength: patch.currentStrength,
        surface_interval_min: patch.surfaceIntervalMin,
        tank_volume_l: patch.tankVolumeL,
      };
      // entryType/diveStyle: undefined 면 미터치 (기존값 보존).
      if (patch.entryType !== undefined) updateRow.entry_type = patch.entryType;
      if (patch.diveStyle !== undefined) updateRow.dive_style = patch.diveStyle;
      // Only write BLE-locked columns if caller supplied them (i.e. dive was
      // not BLE-imported). Trigger 012 will reject if the row is verified.
      if (patch.startedAt !== undefined) updateRow.started_at = patch.startedAt;
      if (patch.endedAt !== undefined) updateRow.ended_at = patch.endedAt;
      if (patch.maxDepth !== undefined) updateRow.max_depth = patch.maxDepth;
      if (patch.avgDepth !== undefined) updateRow.avg_depth = patch.avgDepth;
      if (patch.waterTemp !== undefined) updateRow.water_temp = patch.waterTemp;
      if (patch.tankStartBar !== undefined)
        updateRow.tank_start_bar = patch.tankStartBar;
      if (patch.tankEndBar !== undefined)
        updateRow.tank_end_bar = patch.tankEndBar;

      const { error } = await supabase
        .from("dives")
        .update(updateRow)
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

      // 버디 링크 전체 교체. 같은 패턴 (delete + insert).
      const { error: buddyDelErr } = await supabase
        .from("dive_buddies")
        .delete()
        .eq("dive_id", diveId);
      if (buddyDelErr)
        throw new Error(buddyDelErr.message || JSON.stringify(buddyDelErr));

      if (patch.buddyUserIds.length > 0) {
        const buddyLinks = patch.buddyUserIds.map((uid) => ({
          dive_id: diveId,
          user_id: uid,
        }));
        const { error: buddyInsErr } = await supabase
          .from("dive_buddies")
          .insert(buddyLinks);
        if (buddyInsErr)
          throw new Error(buddyInsErr.message || JSON.stringify(buddyInsErr));
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["dives", userId] });
      qc.invalidateQueries({ queryKey: ["dive", vars.diveId] });
      qc.invalidateQueries({ queryKey: ["dive-user-equipment", vars.diveId] });
      qc.invalidateQueries({ queryKey: ["dive-buddies", vars.diveId] });
      qc.invalidateQueries({
        queryKey: ["dive-buddy-profiles", vars.diveId],
      });
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

// ─────────────────────────────────────────────────────────────────────────────
// BLE Import — Shearwater PNF dives → Supabase
// ─────────────────────────────────────────────────────────────────────────────

import type { ParsedDive } from "@/src/services/ble";

export type ImportDiveInput = {
  parsed: ParsedDive;
  diveNumber: number; // from manifest fingerprint
};

export type ImportResult = {
  inserted: number;
  skipped: number;
  skippedNumbers: number[];
};

export function useImportPnfDives(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: ImportDiveInput[]): Promise<ImportResult> => {
      if (!userId) throw new Error("로그인이 필요해요.");
      const result: ImportResult = { inserted: 0, skipped: 0, skippedNumbers: [] };

      // Pre-fetch existing dive_numbers to skip duplicates without round-tripping.
      const { data: existing, error: exErr } = await supabase
        .from("dives")
        .select("dive_number")
        .eq("user_id", userId);
      if (exErr) throw new Error(exErr.message);
      const taken = new Set(
        ((existing ?? []) as { dive_number: number }[]).map((r) => r.dive_number),
      );

      for (const { parsed, diveNumber } of items) {
        if (taken.has(diveNumber)) {
          result.skipped++;
          result.skippedNumbers.push(diveNumber);
          continue;
        }

        const startedAt = new Date(parsed.timestamp * 1000).toISOString();
        const endSec =
          parsed.timestamp + (parsed.durationS ?? Math.round(parsed.samples.length * (parsed.sampleIntervalMs / 1000)));
        const endedAt = new Date(endSec * 1000).toISOString();

        const { data: ins, error: insErr } = await supabase
          .from("dives")
          .insert({
            user_id: userId,
            dive_number: diveNumber,
            country: "",
            location: "",
            point: null,
            lat: parsed.latitude ?? null,
            lng: parsed.longitude ?? null,
            started_at: startedAt,
            ended_at: endedAt,
            max_depth: parsed.maxDepthM ?? 0,
            avg_depth: parsed.avgDepthM ?? null,
            water_temp: parsed.minTempC ?? null,
            visibility: null,
            weather: null,
            memo: null,
            is_verified: true,
            device_serial: parsed.deviceSerial?.toString() ?? null,
            raw_binary_url: null,
            dive_mode: parsed.diveMode,
            gf_low: parsed.gfLow,
            gf_high: parsed.gfHigh,
            deco_model: parsed.decoModel,
            atmospheric_mbar: parsed.atmosphericMbar,
            water_type: parsed.waterType,
            tank_start_bar: parsed.startPressureBar ?? null,
            tank_end_bar: parsed.endPressureBar ?? null,
            consumption_bar_per_min: parsed.consumptionBarPerMin ?? null,
          })
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        const diveId = (ins as { id: string }).id;

        // Gas mixes
        if (parsed.gasMixes.length > 0) {
          const gasRows = parsed.gasMixes.map((g) => ({
            dive_id: diveId,
            mix_index: g.index,
            o2_pct: g.o2,
            he_pct: g.he,
            is_diluent: g.diluent,
          }));
          const { error: gErr } = await supabase
            .from("dive_gas_mixes")
            .insert(gasRows);
          if (gErr) throw new Error(gErr.message);
        }

        // Samples — batch in chunks of 500 to stay under request size limits.
        if (parsed.samples.length > 0) {
          const sampleRows = parsed.samples.map((s) => ({
            dive_id: diveId,
            time_s: Math.round(s.timeS),
            depth_m: s.depthM,
            temp_c: s.tempC,
            ndl_deco_min: s.ndlDecoMin,
            tts_min: s.ttsMin,
            deco_stop_m: s.decoStopM,
            tank0_bar: s.tank0Bar,
            tank1_bar: s.tank1Bar,
            cns: s.cns,
          }));
          for (let i = 0; i < sampleRows.length; i += 500) {
            const chunk = sampleRows.slice(i, i + 500);
            const { error: sErr } = await supabase
              .from("dive_samples")
              .insert(chunk);
            if (sErr) throw new Error(sErr.message);
          }
        }

        result.inserted++;
        taken.add(diveNumber);
      }

      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dives", userId] });
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
