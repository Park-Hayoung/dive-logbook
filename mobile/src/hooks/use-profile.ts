import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type Profile = {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  diving_org: string | null;
  certification: string | null;
  total_dives_at_signup: number | null;
  bio: string | null;
  team_id: string | null;
  created_at: string;
  updated_at: string;
};

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Profile | null;
    },
  });
}
