import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import type { TablesUpdate } from "@/src/types/database";

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

export type FeedThumb = {
  id: string;
  imageUrl: string;
  createdAt: string;
  hasMultipleMedia: boolean;
};

const FEED_GRID_PAGE_SIZE = 30;

export function useInfiniteUserFeedsWithImages(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["user-feeds-with-images", userId],
    enabled: !!userId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<FeedThumb[]> => {
      let query = supabase
        .from("feeds")
        .select("id, image_url, created_at, linked_dive_id")
        .eq("author_id", userId!)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(FEED_GRID_PAGE_SIZE);
      if (pageParam) {
        query = query.lt("created_at", pageParam);
      }
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as Array<{
        id: string;
        image_url: string;
        created_at: string;
        linked_dive_id: string | null;
      }>;

      const linkedDiveIds = rows
        .map((r) => r.linked_dive_id)
        .filter((x): x is string => !!x);

      const multiCount = new Map<string, number>();
      if (linkedDiveIds.length > 0) {
        const { data: mediaRows, error: mediaError } = await supabase
          .from("dive_media")
          .select("dive_id")
          .in("dive_id", linkedDiveIds);
        if (mediaError) throw mediaError;
        for (const r of (mediaRows ?? []) as unknown as Array<{
          dive_id: string;
        }>) {
          multiCount.set(r.dive_id, (multiCount.get(r.dive_id) ?? 0) + 1);
        }
      }

      return rows.map((r) => ({
        id: r.id,
        imageUrl: r.image_url,
        createdAt: r.created_at,
        hasMultipleMedia: r.linked_dive_id
          ? (multiCount.get(r.linked_dive_id) ?? 0) > 1
          : false,
      }));
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === FEED_GRID_PAGE_SIZE
        ? lastPage[lastPage.length - 1].createdAt
        : undefined,
  });
}

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
      if (!currentUserId) throw new Error("로그인이 필요해요.");
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
      if (!currentUserId) throw new Error("로그인이 필요해요.");
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
      qc.invalidateQueries({
        queryKey: ["user-feeds-with-images", currentUserId],
      });
    },
  });
}

// Extract storage path from a feed-media public URL.
// Layout: https://<ref>.supabase.co/storage/v1/object/public/feed-media/<userId>/<filename>
// Returns null when the URL doesn't belong to the bucket (e.g. external image).
function feedMediaPathFromUrl(publicUrl: string): string | null {
  const marker = "/storage/v1/object/public/feed-media/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

export function useUpdateFeed(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      feedId: string;
      content?: string;
      location?: string | null;
      imageUrl?: string | null;
      previousImageUrl?: string | null;
    }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      const update: TablesUpdate<"feeds"> = {};
      if (input.content !== undefined) update.content = input.content;
      if (input.location !== undefined) update.location = input.location;
      if (input.imageUrl !== undefined) update.image_url = input.imageUrl;

      const { error } = await supabase
        .from("feeds")
        .update(update)
        .eq("id", input.feedId)
        .eq("author_id", currentUserId);
      if (error) throw new Error(error.message || JSON.stringify(error));

      // If imageUrl is being changed (and the old one was in our bucket),
      // remove the old file so we don't accumulate orphans.
      if (
        input.imageUrl !== undefined &&
        input.previousImageUrl &&
        input.previousImageUrl !== input.imageUrl
      ) {
        const oldPath = feedMediaPathFromUrl(input.previousImageUrl);
        if (oldPath) {
          await supabase.storage.from("feed-media").remove([oldPath]);
          // Don't throw on storage cleanup failure — DB row is already updated.
        }
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
      qc.invalidateQueries({ queryKey: ["feed", variables.feedId] });
      qc.invalidateQueries({
        queryKey: ["user-feeds-with-images", currentUserId],
      });
    },
  });
}

export function useDeleteFeed(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      feedId: string;
      imageUrl?: string | null;
    }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");

      const { error } = await supabase
        .from("feeds")
        .delete()
        .eq("id", input.feedId)
        .eq("author_id", currentUserId);
      if (error) throw new Error(error.message || JSON.stringify(error));

      if (input.imageUrl) {
        const path = feedMediaPathFromUrl(input.imageUrl);
        if (path) {
          await supabase.storage.from("feed-media").remove([path]);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
      qc.invalidateQueries({
        queryKey: ["user-feeds-with-images", currentUserId],
      });
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
