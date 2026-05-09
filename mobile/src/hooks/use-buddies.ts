// 버디 관리 훅 — `user_buddies` 테이블 (단골 버디 큐레이션) + `dive_buddies` (다이브-버디 연결).
//
//  - useUserBuddies: 내가 등록한 단골 버디 리스트. "최근에 같이 다이빙한 순"으로 정렬.
//                    한 번도 같이 다이빙 안 한 버디는 created_at 역순으로 뒤에 붙음.
//  - useAddBuddy / useRemoveBuddy: 버디 리스트 추가/삭제.
//  - useFollowing: 내가 팔로우한 사람들 (버디 추가 후보).
//  - useSearchUsersByNickname: 닉네임 부분 일치 검색 (프로필 RLS read=true 라 가능).
//  - useDiveBuddies: 특정 다이브에 연결된 버디 user_id 목록 (수정 화면 프리필).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type BuddyProfile = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  certification: string | null;
  divingOrg: string | null;
};

export type UserBuddy = BuddyProfile & {
  // user_buddies.created_at — 버디로 등록한 시점.
  addedAt: string;
  // 마지막으로 같이 다이빙한 시각 (없으면 null).
  lastDivedAt: string | null;
};

type ProfileLite = {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  certification: string | null;
  diving_org: string | null;
};

const mapProfile = (p: ProfileLite): BuddyProfile => ({
  id: p.id,
  nickname: p.nickname,
  profileImageUrl: p.profile_image_url,
  certification: p.certification,
  divingOrg: p.diving_org,
});

// 내 단골 버디 리스트. 정렬: 가장 최근에 같이 다이빙한 순 → 한 번도 안 한 버디는
// 등록 역순(addedAt desc).
export function useUserBuddies(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-buddies", userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserBuddy[]> => {
      // 1) 내 user_buddies + 버디 프로필 조인
      const { data: rows, error } = await supabase
        .from("user_buddies")
        .select(
          `created_at, buddy_id,
           buddy:profiles!buddy_id(id, nickname, profile_image_url, certification, diving_org)`,
        )
        .eq("user_id", userId!);
      if (error) throw new Error(error.message || JSON.stringify(error));

      const buddies = ((rows ?? []) as unknown as {
        created_at: string;
        buddy_id: string;
        buddy: ProfileLite | null;
      }[])
        .filter((r) => !!r.buddy)
        .map((r) => ({
          addedAt: r.created_at,
          buddyId: r.buddy_id,
          profile: mapProfile(r.buddy as ProfileLite),
        }));

      if (buddies.length === 0) return [];

      // 2) 내 다이브의 dive_buddies 를 한 번에 가져와서 buddyId 별 max(started_at) 계산.
      // dive_buddies 는 public read 지만 dives 는 일반적으로 본인 다이브가 대다수.
      const buddyIds = buddies.map((b) => b.buddyId);
      const { data: dbRows, error: dbErr } = await supabase
        .from("dive_buddies")
        .select(`user_id, dives:dives!dive_id(user_id, started_at)`)
        .in("user_id", buddyIds);
      if (dbErr) throw new Error(dbErr.message || JSON.stringify(dbErr));

      const lastByBuddy = new Map<string, string>();
      for (const r of (dbRows ?? []) as unknown as {
        user_id: string;
        dives: { user_id: string; started_at: string } | null;
      }[]) {
        if (!r.dives) continue;
        // 내 소유 다이브에서 같이 다이빙한 케이스만 카운트.
        if (r.dives.user_id !== userId) continue;
        const cur = lastByBuddy.get(r.user_id);
        if (!cur || r.dives.started_at > cur) {
          lastByBuddy.set(r.user_id, r.dives.started_at);
        }
      }

      const merged: UserBuddy[] = buddies.map((b) => ({
        ...b.profile,
        addedAt: b.addedAt,
        lastDivedAt: lastByBuddy.get(b.buddyId) ?? null,
      }));

      // 정렬: lastDivedAt 내림차순 (null 은 뒤로) → addedAt 내림차순
      merged.sort((a, b) => {
        const al = a.lastDivedAt;
        const bl = b.lastDivedAt;
        if (al && bl) return bl.localeCompare(al);
        if (al && !bl) return -1;
        if (!al && bl) return 1;
        return b.addedAt.localeCompare(a.addedAt);
      });
      return merged;
    },
  });
}

export function useAddBuddy(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (buddyId: string) => {
      if (!userId) throw new Error("로그인이 필요해요.");
      if (userId === buddyId) throw new Error("본인을 버디로 추가할 수 없어요.");
      const { error } = await supabase
        .from("user_buddies")
        .insert({ user_id: userId, buddy_id: buddyId });
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-buddies", userId] });
    },
  });
}

export function useRemoveBuddy(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (buddyId: string) => {
      if (!userId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase
        .from("user_buddies")
        .delete()
        .eq("user_id", userId)
        .eq("buddy_id", buddyId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-buddies", userId] });
    },
  });
}

// 내가 팔로우한 사람들 — 버디 추가 화면의 두 번째 섹션.
export function useFollowing(userId: string | undefined) {
  return useQuery({
    queryKey: ["following", userId],
    enabled: !!userId,
    queryFn: async (): Promise<BuddyProfile[]> => {
      const { data, error } = await supabase
        .from("follows")
        .select(
          `following:profiles!following_id(id, nickname, profile_image_url, certification, diving_org)`,
        )
        .eq("follower_id", userId!);
      if (error) throw new Error(error.message || JSON.stringify(error));
      const rows = (data ?? []) as unknown as {
        following: ProfileLite | null;
      }[];
      return rows
        .map((r) => r.following)
        .filter((p): p is ProfileLite => !!p)
        .map(mapProfile)
        .sort((a, b) => a.nickname.localeCompare(b.nickname));
    },
  });
}

// 닉네임 부분 일치 검색. 자기 자신은 결과에서 제외.
export function useSearchUsersByNickname(
  query: string,
  currentUserId: string | undefined,
) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["search-users", trimmed, currentUserId],
    enabled: trimmed.length >= 1 && !!currentUserId,
    queryFn: async (): Promise<BuddyProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, nickname, profile_image_url, certification, diving_org",
        )
        .ilike("nickname", `%${trimmed}%`)
        .neq("id", currentUserId!)
        .order("nickname")
        .limit(30);
      if (error) throw new Error(error.message || JSON.stringify(error));
      return ((data ?? []) as unknown as ProfileLite[]).map(mapProfile);
    },
  });
}

// 특정 다이브에 연결된 버디 user_id 목록 (수정 화면 프리필).
export function useDiveBuddies(diveId: string | undefined) {
  return useQuery({
    queryKey: ["dive-buddies", diveId],
    enabled: !!diveId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("dive_buddies")
        .select("user_id")
        .eq("dive_id", diveId!);
      if (error) throw new Error(error.message || JSON.stringify(error));
      return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
    },
  });
}

// 다이브 상세 화면용 — 연결된 버디들의 프로필까지.
// dive_buddies 는 (dive_id, user_id) 만 있는 junction 이라 PostgREST embed 가 가끔
// 비어서 오는 케이스가 있어, ID 만 먼저 가져온 뒤 profiles 를 별도 쿼리로 합친다.
export function useDiveBuddyProfiles(diveId: string | undefined) {
  return useQuery({
    queryKey: ["dive-buddy-profiles", diveId],
    enabled: !!diveId,
    queryFn: async (): Promise<BuddyProfile[]> => {
      const { data: dbRows, error: dbErr } = await supabase
        .from("dive_buddies")
        .select("user_id")
        .eq("dive_id", diveId!);
      if (dbErr) throw new Error(dbErr.message || JSON.stringify(dbErr));
      const ids = ((dbRows ?? []) as { user_id: string }[]).map(
        (r) => r.user_id,
      );
      if (ids.length === 0) return [];

      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, nickname, profile_image_url, certification, diving_org")
        .in("id", ids);
      if (pErr) throw new Error(pErr.message || JSON.stringify(pErr));
      return ((profs ?? []) as unknown as ProfileLite[])
        .map(mapProfile)
        .sort((a, b) => a.nickname.localeCompare(b.nickname));
    },
  });
}
