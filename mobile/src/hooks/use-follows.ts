import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type FollowCounts = {
  followers: number;
  following: number;
};

export function useFollowCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ["follow-counts", userId],
    enabled: !!userId,
    queryFn: async (): Promise<FollowCounts> => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", userId!),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", userId!),
      ]);
      return {
        followers: followers ?? 0,
        following: following ?? 0,
      };
    },
  });
}

export function useIsFollowing(
  followerId: string | undefined,
  followingId: string | undefined,
) {
  return useQuery({
    queryKey: ["is-following", followerId, followingId],
    enabled: !!followerId && !!followingId && followerId !== followingId,
    queryFn: async (): Promise<boolean> => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", followerId!)
        .eq("following_id", followingId!)
        .maybeSingle();
      return !!data;
    },
  });
}

export function useToggleFollow(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      targetUserId: string;
      currentlyFollowing: boolean;
    }) => {
      if (!currentUserId) throw new Error("로그인이 필요합니다.");
      if (currentUserId === input.targetUserId) {
        throw new Error("본인을 팔로우할 수 없습니다.");
      }
      if (input.currentlyFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", input.targetUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: currentUserId,
          following_id: input.targetUserId,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["follow-counts"] });
      qc.invalidateQueries({
        queryKey: ["is-following", currentUserId, variables.targetUserId],
      });
    },
  });
}
