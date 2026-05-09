import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

// `feed_comment_likes` is added in migration 014; until DB types are regenerated
// (`supabase gen types typescript`), bypass the typed table list for this table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

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
  likeCount: number;
  myLiked: boolean;
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

const mapComment = (
  r: CommentRow,
  likeCount: number,
  myLiked: boolean,
): FeedComment => ({
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
  likeCount,
  myLiked,
});

export function useFeedComments(
  feedId: string | undefined,
  currentUserId?: string | undefined,
) {
  return useQuery({
    queryKey: ["feed-comments", feedId, currentUserId ?? "anon"],
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

      const rows = (data ?? []) as unknown as CommentRow[];

      // Likes are in a separate table that may not yet exist (migration 014).
      // Fetch them in a separate try/catch so comments still render if missing.
      const likeCounts = new Map<string, number>();
      const likedSet = new Set<string>();
      if (rows.length > 0) {
        try {
          const { data: likes } = await sb
            .from("feed_comment_likes")
            .select("comment_id, user_id")
            .in(
              "comment_id",
              rows.map((r) => r.id),
            );
          for (const l of (likes ?? []) as Array<{
            comment_id: string;
            user_id: string;
          }>) {
            likeCounts.set(
              l.comment_id,
              (likeCounts.get(l.comment_id) ?? 0) + 1,
            );
            if (currentUserId && l.user_id === currentUserId) {
              likedSet.add(l.comment_id);
            }
          }
        } catch {
          // feed_comment_likes table missing — comments still render without likes.
        }
      }

      return rows.map((r) =>
        mapComment(r, likeCounts.get(r.id) ?? 0, likedSet.has(r.id)),
      );
    },
  });
}

export function useToggleFeedCommentLike(
  feedId: string | undefined,
  currentUserId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      commentId: string;
      currentlyLiked: boolean;
    }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      if (input.currentlyLiked) {
        const { error } = await sb
          .from("feed_comment_likes")
          .delete()
          .eq("comment_id", input.commentId)
          .eq("user_id", currentUserId);
        if (error) throw new Error(error.message || JSON.stringify(error));
      } else {
        const { error } = await sb.from("feed_comment_likes").insert({
          comment_id: input.commentId,
          user_id: currentUserId,
        });
        if (error) throw new Error(error.message || JSON.stringify(error));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-comments", feedId] });
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
      if (!feedId || !currentUserId) throw new Error("로그인이 필요해요.");
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
