import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import { mediaStorage } from "@/src/services/media-storage";
import type { MediaProvider } from "@/src/types/dive";

export type FeedMedia = {
  id: string;
  feedId: string;
  storageUrl: string;
  kind: "image" | "video";
  provider: MediaProvider;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  uploadedAt: string;
};

type FeedMediaRow = {
  id: string;
  feed_id: string;
  storage_url: string;
  kind: "image" | "video";
  provider: MediaProvider;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  uploaded_at: string;
};

const mapFeedMedia = (row: FeedMediaRow): FeedMedia => ({
  id: row.id,
  feedId: row.feed_id,
  storageUrl: row.storage_url,
  kind: row.kind,
  provider: row.provider,
  thumbnailUrl: row.thumbnail_url,
  durationSeconds: row.duration_seconds,
  width: row.width,
  height: row.height,
  uploadedAt: row.uploaded_at,
});

export function useFeedMedia(feedId: string | undefined) {
  return useQuery({
    queryKey: ["feed-media", feedId],
    enabled: !!feedId,
    queryFn: async (): Promise<FeedMedia[]> => {
      const { data, error } = await supabase
        .from("feed_media")
        .select("*")
        .eq("feed_id", feedId!)
        .order("uploaded_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as FeedMediaRow[]).map(mapFeedMedia);
    },
  });
}

export type FeedMediaUpload = {
  localUri: string;
  kind: "image" | "video";
  contentType: string;
  originalFilename: string;
  thumbnailUri?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
};

async function uploadThumbnail(thumbnailUri: string): Promise<string | null> {
  try {
    const uploaded = await mediaStorage.upload({
      scope: { type: "feed" },
      localUri: thumbnailUri,
      originalFilename: `thumb-${Date.now()}.jpg`,
      contentType: "image/jpeg",
      kind: "image",
    });
    return uploaded.url;
  } catch (e) {
    console.warn("feed thumbnail upload failed", e);
    return null;
  }
}

/**
 * Uploads a single media file to NAS, then inserts a feed_media row.
 * Caller is responsible for ordering/aggregating across multiple files.
 */
export function useUploadFeedMedia() {
  return useMutation({
    mutationFn: async (input: {
      feedId: string;
      file: FeedMediaUpload;
    }): Promise<FeedMedia> => {
      const uploaded = await mediaStorage.upload({
        scope: { type: "feed" },
        localUri: input.file.localUri,
        originalFilename: input.file.originalFilename,
        contentType: input.file.contentType,
        kind: input.file.kind,
      });

      const thumbnailUrl =
        input.file.kind === "video" && input.file.thumbnailUri
          ? await uploadThumbnail(input.file.thumbnailUri)
          : null;

      const { data, error } = await supabase
        .from("feed_media")
        .insert({
          feed_id: input.feedId,
          storage_url: uploaded.url,
          kind: input.file.kind,
          provider: uploaded.provider,
          file_size_bytes: uploaded.sizeBytes,
          original_filename: uploaded.filename,
          thumbnail_url: thumbnailUrl,
          duration_seconds: input.file.durationSeconds ?? null,
          width: input.file.width ?? null,
          height: input.file.height ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return mapFeedMedia(data as unknown as FeedMediaRow);
    },
  });
}

export function useDeleteFeedMedia(feedId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mediaId: string) => {
      const { error } = await supabase
        .from("feed_media")
        .delete()
        .eq("id", mediaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-media", feedId] });
    },
  });
}
