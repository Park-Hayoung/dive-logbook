import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import type { Dive } from "@/src/types/dive";

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
      return (data ?? []) as unknown as Dive[];
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
        .single();
      if (error) throw error;
      return data as unknown as Dive;
    },
  });
}
