import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type DiveSample = {
  timeS: number;
  depthM: number;
  tempC: number | null;
  ndlDecoMin: number | null;
  ttsMin: number | null;
  decoStopM: number | null;
  tank0Bar: number | null;
  tank1Bar: number | null;
  cns: number | null;
};

type SampleRow = {
  time_s: number;
  depth_m: number | string;
  temp_c: number | string | null;
  ndl_deco_min: number | null;
  tts_min: number | null;
  deco_stop_m: number | string | null;
  tank0_bar: number | string | null;
  tank1_bar: number | string | null;
  cns: number | string | null;
};

const num = (v: number | string | null): number | null =>
  v === null ? null : typeof v === "number" ? v : Number(v);

export function useDiveSamples(diveId: string | undefined) {
  return useQuery({
    queryKey: ["dive-samples", diveId],
    enabled: !!diveId,
    queryFn: async (): Promise<DiveSample[]> => {
      const { data, error } = await supabase
        .from("dive_samples")
        .select(
          "time_s, depth_m, temp_c, ndl_deco_min, tts_min, deco_stop_m, tank0_bar, tank1_bar, cns",
        )
        .eq("dive_id", diveId!)
        .order("time_s", { ascending: true });
      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown as SampleRow[]).map((r) => ({
        timeS: r.time_s,
        depthM: num(r.depth_m) ?? 0,
        tempC: num(r.temp_c),
        ndlDecoMin: r.ndl_deco_min,
        ttsMin: r.tts_min,
        decoStopM: num(r.deco_stop_m),
        tank0Bar: num(r.tank0_bar),
        tank1Bar: num(r.tank1_bar),
        cns: num(r.cns),
      }));
    },
  });
}

export type DiveGasMix = {
  index: number;
  o2: number;
  he: number;
  isDiluent: boolean;
};

type GasRow = {
  mix_index: number;
  o2_pct: number;
  he_pct: number;
  is_diluent: boolean;
};

export function useDiveGasMixes(diveId: string | undefined) {
  return useQuery({
    queryKey: ["dive-gas-mixes", diveId],
    enabled: !!diveId,
    queryFn: async (): Promise<DiveGasMix[]> => {
      const { data, error } = await supabase
        .from("dive_gas_mixes")
        .select("mix_index, o2_pct, he_pct, is_diluent")
        .eq("dive_id", diveId!)
        .order("mix_index", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as GasRow[]).map((r) => ({
        index: r.mix_index,
        o2: r.o2_pct,
        he: r.he_pct,
        isDiluent: r.is_diluent,
      }));
    },
  });
}
