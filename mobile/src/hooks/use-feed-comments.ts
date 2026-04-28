import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type FeedComment = {
  id: string;
  feedId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
  } | null;
};

type CommentRow = {
  id: string;
  feed_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author:
    | { id: string; nickname: string; profile_image_url: string | null }
    | null;
};

const mapComment = (r: CommentRow): FeedComment => ({
  id: r.id,
  feedId: r.feed_id,
  authorId: r.author_id,
  content: r.content,
  createdAt: r.created_at,
  author: r.author
    ? {
        id: r.author.id,
        nickname: r.author.nickname,
        profileImageUrl: r.author.profile_image_url,
      }
    : null,
});

export function useFeedComments(feedId: string | undefined) {
  return useQuery({
    queryKey: ["feed-comments", feedId],
    enabled: !!feedId,
    queryFn: async (): Promise<FeedComment[]> => {
      const { data, error } = await supabase
        .from("feed_comments")
        .select(
          `*, author:profiles!author_id(id, nickname, profile_image_url)`,
        )
        .eq("feed_id", feedId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as CommentRow[]).map(mapComment);
    },
  });
}

export function useAddFeedComment(
  feedId: string | undefined,
  currentUserId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      if (!feedId || !currentUserId) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase.from("feed_comments").insert({
        feed_id: feedId,
        author_id: currentUserId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-comments", feedId] });
      qc.invalidateQueries({ queryKey: ["feed", feedId] });
      qc.invalidateQueries({ queryKey: ["feeds"] });
    },
  });
}
