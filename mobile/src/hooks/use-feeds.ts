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

export type FeedItemComment = {
  id: string;
  content: string;
  createdAt: string;
  author: FeedAuthor | null;
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
  recentComments: FeedItemComment[];
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
  imageUrl: string | null;
  videoUrl: string | null;
  kind: "image" | "video";
  createdAt: string;
  hasMultipleMedia: boolean;
};

const FEED_GRID_PAGE_SIZE = 30;

export function useUserFeedCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-feed-count", userId],
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("feeds")
        .select("id", { count: "exact", head: true })
        .eq("author_id", userId!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

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
        .or("image_url.not.is.null,linked_dive_id.not.is.null")
        .order("created_at", { ascending: false })
        .limit(FEED_GRID_PAGE_SIZE);
      if (pageParam) {
        query = query.lt("created_at", pageParam);
      }
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as Array<{
        id: string;
        image_url: string | null;
        created_at: string;
        linked_dive_id: string | null;
      }>;

      const linkedDiveIds = rows
        .map((r) => r.linked_dive_id)
        .filter((x): x is string => !!x);

      type MediaRow = {
        dive_id: string;
        storage_url: string;
        kind: "image" | "video";
        thumbnail_url: string | null;
        uploaded_at: string;
      };
      const mediaByDive = new Map<string, MediaRow[]>();
      if (linkedDiveIds.length > 0) {
        const { data: mediaRows, error: mediaError } = await supabase
          .from("dive_media")
          .select("dive_id, storage_url, kind, thumbnail_url, uploaded_at")
          .in("dive_id", linkedDiveIds)
          .order("uploaded_at", { ascending: false });
        if (mediaError) throw mediaError;
        for (const r of (mediaRows ?? []) as unknown as MediaRow[]) {
          const arr = mediaByDive.get(r.dive_id) ?? [];
          arr.push(r);
          mediaByDive.set(r.dive_id, arr);
        }
      }

      const thumbs: FeedThumb[] = [];
      for (const r of rows) {
        const media = r.linked_dive_id
          ? mediaByDive.get(r.linked_dive_id)
          : undefined;
        const cover = media?.[0];
        if (cover) {
          if (cover.kind === "video") {
            thumbs.push({
              id: r.id,
              imageUrl: cover.thumbnail_url ?? r.image_url,
              videoUrl: cover.storage_url,
              kind: "video",
              createdAt: r.created_at,
              hasMultipleMedia: media!.length > 1,
            });
          } else {
            thumbs.push({
              id: r.id,
              imageUrl: cover.storage_url,
              videoUrl: null,
              kind: "image",
              createdAt: r.created_at,
              hasMultipleMedia: media!.length > 1,
            });
          }
        } else if (r.image_url) {
          thumbs.push({
            id: r.id,
            imageUrl: r.image_url,
            videoUrl: null,
            kind: "image",
            createdAt: r.created_at,
            hasMultipleMedia: false,
          });
        }
      }
      return thumbs;
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

      const feedRows = (data ?? []) as unknown as FeedRow[];
      const feedIds = feedRows.map((r) => r.id);

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

      const commentsByFeed = new Map<string, FeedItemComment[]>();
      if (feedIds.length > 0) {
        const { data: commentRows, error: commentErr } = await supabase
          .from("feed_comments")
          .select(
            `id, feed_id, content, created_at,
            author:profiles!author_id(id, nickname, profile_image_url)`,
          )
          .in("feed_id", feedIds)
          .order("created_at", { ascending: false });
        if (commentErr) throw commentErr;

        type CommentRow = {
          id: string;
          feed_id: string;
          content: string;
          created_at: string;
          author:
            | { id: string; nickname: string; profile_image_url: string | null }
            | null;
        };
        for (const c of (commentRows ?? []) as unknown as CommentRow[]) {
          const arr = commentsByFeed.get(c.feed_id) ?? [];
          if (arr.length >= 3) continue;
          arr.push({
            id: c.id,
            content: c.content,
            createdAt: c.created_at,
            author: c.author
              ? {
                  id: c.author.id,
                  nickname: c.author.nickname,
                  profileImageUrl: c.author.profile_image_url,
                }
              : null,
          });
          commentsByFeed.set(c.feed_id, arr);
        }
        // reverse so the oldest of the latest 3 appears first (chronological)
        for (const [k, arr] of commentsByFeed) {
          commentsByFeed.set(k, arr.reverse());
        }
      }

      return feedRows.map((r) => ({
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
        recentComments: commentsByFeed.get(r.id) ?? [],
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

export type FeedMediaInsert = {
  storageUrl: string;
  kind: "image" | "video";
  provider?: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  fileSizeBytes?: number | null;
  originalFilename?: string | null;
};

export function useCreateFeed(currentUserId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      content: string;
      type?: "log" | "normal";
      location?: string | null;
      linkedDiveId?: string | null;
      imageUrl?: string | null;
      /** Optional multi-media list (non-log feeds). First item's URL becomes the cover. */
      media?: FeedMediaInsert[];
    }) => {
      if (!currentUserId) throw new Error("로그인이 필요해요.");
      const cover =
        input.imageUrl ?? input.media?.[0]?.storageUrl ?? null;
      const { data: feedRow, error } = await supabase
        .from("feeds")
        .insert({
          author_id: currentUserId,
          type: input.type ?? "normal",
          content: input.content,
          location: input.location ?? null,
          linked_dive_id: input.linkedDiveId ?? null,
          image_url: cover,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));

      if (input.media && input.media.length > 0) {
        const feedId = (feedRow as unknown as { id: string }).id;
        const rows = input.media.map((m) => ({
          feed_id: feedId,
          storage_url: m.storageUrl,
          kind: m.kind,
          provider: m.provider ?? "synology",
          thumbnail_url: m.thumbnailUrl ?? null,
          duration_seconds: m.durationSeconds ?? null,
          width: m.width ?? null,
          height: m.height ?? null,
          file_size_bytes: m.fileSizeBytes ?? null,
          original_filename: m.originalFilename ?? null,
        }));
        // feed_media 타입은 supabase gen types 재실행 후 인식됨. 우회.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: mediaErr } = await (supabase as any)
          .from("feed_media")
          .insert(rows);
        if (mediaErr)
          throw new Error(mediaErr.message || JSON.stringify(mediaErr));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
      qc.invalidateQueries({
        queryKey: ["user-feeds-with-images", currentUserId],
      });
      qc.invalidateQueries({
        queryKey: ["user-feed-count", currentUserId],
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
        recentComments: [],
      };
    },
  });
}
