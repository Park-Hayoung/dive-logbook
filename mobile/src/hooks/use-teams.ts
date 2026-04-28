import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type Team = {
  id: string;
  name: string;
  leaderId: string | null;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  memberCount: number;
};

export type TeamMember = {
  teamId: string;
  userId: string;
  role: "leader" | "member" | "pending";
  joinedAt: string;
  profile: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
    certification: string | null;
  } | null;
};

type TeamRow = {
  id: string;
  name: string;
  leader_id: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
  team_members: { count: number }[] | null;
};

const wrapError = (e: { message?: string } | null): never => {
  throw new Error(e?.message || JSON.stringify(e));
};

const mapTeam = (r: TeamRow): Team => ({
  id: r.id,
  name: r.name,
  leaderId: r.leader_id,
  description: r.description,
  imageUrl: r.image_url,
  createdAt: r.created_at,
  memberCount: r.team_members?.[0]?.count ?? 0,
});

export function useTeams(searchTerm: string) {
  return useQuery({
    queryKey: ["teams", searchTerm],
    queryFn: async (): Promise<Team[]> => {
      let q = supabase
        .from("teams")
        .select(
          "id,name,leader_id,description,image_url,created_at,team_members(count)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (searchTerm.trim()) q = q.ilike("name", `%${searchTerm.trim()}%`);
      const { data, error } = await q;
      if (error) wrapError(error);
      return ((data ?? []) as unknown as TeamRow[]).map(mapTeam);
    },
  });
}

export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: ["team", teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<Team | null> => {
      const { data, error } = await supabase
        .from("teams")
        .select(
          "id,name,leader_id,description,image_url,created_at,team_members(count)",
        )
        .eq("id", teamId!)
        .maybeSingle();
      if (error) wrapError(error);
      return data ? mapTeam(data as unknown as TeamRow) : null;
    },
  });
}

type MemberRow = {
  team_id: string;
  user_id: string;
  role: "leader" | "member" | "pending";
  joined_at: string;
  profile:
    | {
        id: string;
        nickname: string;
        profile_image_url: string | null;
        certification: string | null;
      }
    | null;
};

const mapMember = (r: MemberRow): TeamMember => ({
  teamId: r.team_id,
  userId: r.user_id,
  role: r.role,
  joinedAt: r.joined_at,
  profile: r.profile
    ? {
        id: r.profile.id,
        nickname: r.profile.nickname,
        profileImageUrl: r.profile.profile_image_url,
        certification: r.profile.certification,
      }
    : null,
});

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: ["team-members", teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select(
          `team_id, user_id, role, joined_at,
           profile:profiles!user_id(id, nickname, profile_image_url, certification)`,
        )
        .eq("team_id", teamId!);
      if (error) wrapError(error);
      const rows = (data ?? []) as unknown as MemberRow[];
      // Sort: leader first, then members, then pending; alphabetical within
      const order = { leader: 0, member: 1, pending: 2 };
      return rows
        .map(mapMember)
        .sort(
          (a, b) =>
            order[a.role] - order[b.role] ||
            (a.profile?.nickname ?? "").localeCompare(b.profile?.nickname ?? ""),
        );
    },
  });
}

// Find current user's team membership (member or leader, not pending)
export function useMyTeam(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-team", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select(
          `team_id, role,
           team:teams!team_id(id, name, image_url, leader_id)`,
        )
        .eq("user_id", userId!)
        .in("role", ["leader", "member"])
        .maybeSingle();
      if (error) wrapError(error);
      return data as unknown as {
        team_id: string;
        role: "leader" | "member";
        team: {
          id: string;
          name: string;
          image_url: string | null;
          leader_id: string | null;
        } | null;
      } | null;
    },
  });
}

export function useCreateTeam(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string | null }) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      const { data: team, error } = await supabase
        .from("teams")
        .insert({
          name: input.name,
          leader_id: userId,
          description: input.description ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      // Add creator as leader in team_members
      const { error: memberError } = await supabase
        .from("team_members")
        .insert({
          team_id: (team as unknown as { id: string }).id,
          user_id: userId,
          role: "leader",
        });
      if (memberError) throw new Error(memberError.message);
      return (team as unknown as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["my-team"] });
    },
  });
}

export function useRequestJoinTeam(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase.from("team_members").insert({
        team_id: teamId,
        user_id: userId,
        role: "pending",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, teamId) => {
      qc.invalidateQueries({ queryKey: ["team-members", teamId] });
      qc.invalidateQueries({ queryKey: ["team", teamId] });
      qc.invalidateQueries({ queryKey: ["my-team"] });
    },
  });
}

export function useLeaveTeam(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, teamId) => {
      qc.invalidateQueries({ queryKey: ["team-members", teamId] });
      qc.invalidateQueries({ queryKey: ["team", teamId] });
      qc.invalidateQueries({ queryKey: ["my-team"] });
    },
  });
}

export function useApproveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { teamId: string; userId: string }) => {
      const { error } = await supabase
        .from("team_members")
        .update({ role: "member" })
        .eq("team_id", input.teamId)
        .eq("user_id", input.userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team-members", vars.teamId] });
      qc.invalidateQueries({ queryKey: ["team", vars.teamId] });
    },
  });
}

export function useRejectTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { teamId: string; userId: string }) => {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", input.teamId)
        .eq("user_id", input.userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["team-members", vars.teamId] });
      qc.invalidateQueries({ queryKey: ["team", vars.teamId] });
    },
  });
}
