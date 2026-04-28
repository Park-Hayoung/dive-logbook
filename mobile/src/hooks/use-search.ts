import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type ProfileSearchResult = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  certification: string | null;
  divingOrg: string | null;
};

type ProfileRow = {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  certification: string | null;
  diving_org: string | null;
};

export function useSearchProfiles(term: string) {
  const trimmed = term.trim();
  return useQuery({
    queryKey: ["search-profiles", trimmed],
    enabled: trimmed.length >= 1,
    queryFn: async (): Promise<ProfileSearchResult[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nickname,profile_image_url,certification,diving_org")
        .ilike("nickname", `%${trimmed}%`)
        .order("nickname")
        .limit(30);
      if (error) throw new Error(error.message || JSON.stringify(error));
      return ((data ?? []) as unknown as ProfileRow[]).map((r) => ({
        id: r.id,
        nickname: r.nickname,
        profileImageUrl: r.profile_image_url,
        certification: r.certification,
        divingOrg: r.diving_org,
      }));
    },
  });
}
