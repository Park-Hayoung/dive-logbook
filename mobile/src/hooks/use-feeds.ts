import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type FeedAuthor = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
};

export type FeedItem = {
  id: string;
  authorId: string;
  type: "log" | "normal" | "ad";
  content: string | null;
  imageUrl: string | null;
  location: string | null;
  linkedDiveId: string | null;
  createdAt: string;
  author: FeedAuthor | null;
  likeCount: number;
  commentCount: number;
  myLiked: boolean;
};

type FeedRow = {
  id: string;
  author_id: string;
  type: "log" | "normal" | "ad";
  content: string | null;
  image_url: string | null;
  location: string | null;
  linked_dive_id: string | null;
  created_at: string;
  author:
    | { id: string; nickname: string; profile_image_url: string | null }
    | null;
  feed_likes: { count: number }[] | null;
  feed_comments: { count: number }[] | null;
};

export function useFeeds(currentUserId: string | undefined) {
  return useQuery({
    queryKey: ["feeds", currentUserId ?? "anon"],
    queryFn: async (): Promise<FeedItem[]> => {
      const { data, error } = await supabase
        .from("feeds")
        .select(
          `*,
          author:profiles!author_id(id, nickname, profile_image_url),
          feed_likes(count),
          feed_comments(count)`,
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      let mineSet = new Set<string>();
      if (currentUserId) {
        const { data: mine } = await supabase
          .from("feed_likes")
          .select("feed_id")
          .eq("user_id", currentUserId);
        mineSet = new Set(
          ((mine ?? []) as unknown as { feed_id: string }[]).map(
            (r) => r.feed_id,
          ),
        );
      }

      return ((data ?? []) as unknown as FeedRow[]).map((r) => ({
        id: r.id,
        authorId: r.author_id,
        type: r.type,
        content: r.content,
        imageUrl: r.image_url,
        location: r.location,
        linkedDiveId: r.linked_dive_id,
        createdAt: r.created_at,
        author: r.author
          ? {
              id: r.author.id,
              nickname: r.author.nickname,
              profileImageUrl: r.author.profile_image_url,
            }
          : null,
        likeCount: r.feed_likes?.[0]?.count ?? 0,
        commentCount: r.feed_comments?.[0]?.count ?? 0,
        myLiked: mineSet.has(r.id),
      }));
    },
  });
}

export function useToggleFeedLike(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { feedId: string; currentlyLiked: boolean }) => {
      if (!currentUserId) throw new Error("로그인이 필요합니다.");
      if (input.currentlyLiked) {
        const { error } = await supabase
          .from("feed_likes")
          .delete()
          .eq("feed_id", input.feedId)
          .eq("user_id", currentUserId);
        if (error) throw new Error(error.message || JSON.stringify(error));
      } else {
        const { error } = await supabase.from("feed_likes").insert({
          feed_id: input.feedId,
          user_id: currentUserId,
        });
        if (error) throw new Error(error.message || JSON.stringify(error));
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
      qc.invalidateQueries({ queryKey: ["feed", variables.feedId] });
    },
  });
}

export function useCreateFeed(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      content: string;
      type?: "log" | "normal";
      location?: string | null;
      linkedDiveId?: string | null;
      imageUrl?: string | null;
    }) => {
      if (!currentUserId) throw new Error("로그인이 필요합니다.");
      const { error } = await supabase.from("feeds").insert({
        author_id: currentUserId,
        type: input.type ?? "normal",
        content: input.content,
        location: input.location ?? null,
        linked_dive_id: input.linkedDiveId ?? null,
        image_url: input.imageUrl ?? null,
      });
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
    },
  });
}

export function useFeed(feedId: string | undefined, currentUserId: string | undefined) {
  return useQuery({
    queryKey: ["feed", feedId, currentUserId ?? "anon"],
    enabled: !!feedId,
    queryFn: async (): Promise<FeedItem | null> => {
      const { data, error } = await supabase
        .from("feeds")
        .select(
          `*,
          author:profiles!author_id(id, nickname, profile_image_url),
          feed_likes(count),
          feed_comments(count)`,
        )
        .eq("id", feedId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      let myLiked = false;
      if (currentUserId) {
        const { data: mine } = await supabase
          .from("feed_likes")
          .select("feed_id")
          .eq("feed_id", feedId!)
          .eq("user_id", currentUserId)
          .maybeSingle();
        myLiked = !!mine;
      }

      const r = data as unknown as FeedRow;
      return {
        id: r.id,
        authorId: r.author_id,
        type: r.type,
        content: r.content,
        imageUrl: r.image_url,
        location: r.location,
        linkedDiveId: r.linked_dive_id,
        createdAt: r.created_at,
        author: r.author
          ? {
              id: r.author.id,
              nickname: r.author.nickname,
              profileImageUrl: r.author.profile_image_url,
            }
          : null,
        likeCount: r.feed_likes?.[0]?.count ?? 0,
        commentCount: r.feed_comments?.[0]?.count ?? 0,
        myLiked,
      };
    },
  });
}
