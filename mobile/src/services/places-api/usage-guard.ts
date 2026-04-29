import { supabase } from "@/src/services/supabase";

export type UsageResult = {
  allowed: boolean;
  usedToday: number;
  cap: number;
};

type RpcRow = {
  allowed: boolean;
  used_today: number;
  cap: number;
};

// Places API HTTP 호출 직전에 부르는 enforcement gate.
// allowed=false 면 호출자는 Google API 를 부르지 않고 폴백(직접 입력) 으로 전환.
// 카운트는 RPC 안에서 원자적으로 +1.
export async function bumpPlacesUsage(): Promise<UsageResult> {
  // database.ts 가 자동 생성될 때까지 RPC 시그니처 미지정 → 타입 캐스트.
  const { data, error } = await supabase.rpc(
    "bump_places_usage" as never,
  );
  if (error) throw error;
  const rows = data as unknown as RpcRow[] | RpcRow | null;
  const row = (Array.isArray(rows) ? rows[0] : rows) as RpcRow | null;
  if (!row) throw new Error("bump_places_usage returned empty result");
  return {
    allowed: !!row.allowed,
    usedToday: row.used_today ?? 0,
    cap: row.cap ?? 0,
  };
}
