import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type DiveSchedule = {
  id: string;
  userId: string;
  title: string;
  startDate: string;
  endDate: string;
  point: string | null;
  shopId: string | null;
  shopName: string | null;
  createdAt: string;
};

type ScheduleRow = {
  id: string;
  user_id: string;
  title: string;
  start_date: string;
  end_date: string;
  point: string | null;
  shop_id: string | null;
  created_at: string;
};

const todayIso = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const mapSchedule = (
  r: ScheduleRow,
  shopName: string | null,
): DiveSchedule => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  startDate: r.start_date,
  endDate: r.end_date,
  point: r.point,
  shopId: r.shop_id,
  shopName,
  createdAt: r.created_at,
});

export function useUpcomingSchedules(userId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["upcoming-schedules", userId, limit],
    enabled: !!userId,
    queryFn: async (): Promise<DiveSchedule[]> => {
      const { data, error } = await supabase
        .from("dive_schedules")
        .select("id,user_id,title,start_date,end_date,point,shop_id,created_at")
        .eq("user_id", userId!)
        .gte("end_date", todayIso())
        .order("start_date", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message || JSON.stringify(error));
      const rows = (data ?? []) as unknown as ScheduleRow[];

      // Resolve shop names in a separate batch (only if any rows reference shops).
      const shopIds = Array.from(
        new Set(rows.map((r) => r.shop_id).filter((id): id is string => !!id)),
      );
      const shopNames = new Map<string, string>();
      if (shopIds.length > 0) {
        const { data: shopRows } = await supabase
          .from("shops")
          .select("id,name")
          .in("id", shopIds);
        for (const s of (shopRows ?? []) as { id: string; name: string }[]) {
          shopNames.set(s.id, s.name);
        }
      }

      return rows.map((r) =>
        mapSchedule(r, r.shop_id ? (shopNames.get(r.shop_id) ?? null) : null),
      );
    },
  });
}

export function useCreateDiveSchedule(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      startDate: string;
      endDate: string;
      point?: string | null;
      shopId?: string | null;
    }) => {
      if (!userId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase.from("dive_schedules").insert({
        user_id: userId,
        title: input.title,
        start_date: input.startDate,
        end_date: input.endDate,
        point: input.point ?? null,
        shop_id: input.shopId ?? null,
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upcoming-schedules"] });
    },
  });
}

export function useDeleteDiveSchedule(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      if (!userId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase
        .from("dive_schedules")
        .delete()
        .eq("id", scheduleId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upcoming-schedules"] });
    },
  });
}
