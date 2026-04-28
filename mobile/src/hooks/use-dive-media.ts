import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import { mediaStorage } from "@/src/services/media-storage";
import type { DiveMedia, MediaProvider } from "@/src/types/dive";

type DiveMediaRow = {
  id: string;
  dive_id: string;
  storage_url: string;
  kind: "image" | "video";
  provider: MediaProvider;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  original_filename: string | null;
  width: number | null;
  height: number | null;
  uploaded_at: string;
};

const mapMedia = (row: DiveMediaRow): DiveMedia => ({
  id: row.id,
  diveId: row.dive_id,
  storageUrl: row.storage_url,
  kind: row.kind,
  provider: row.provider,
  fileSizeBytes: row.file_size_bytes,
  durationSeconds: row.duration_seconds,
  thumbnailUrl: row.thumbnail_url,
  originalFilename: row.original_filename,
  width: row.width,
  height: row.height,
  uploadedAt: row.uploaded_at,
});

export function useDiveMedia(diveId: string | undefined) {
  return useQuery({
    queryKey: ["dive-media", diveId],
    enabled: !!diveId,
    queryFn: async (): Promise<DiveMedia[]> => {
      const { data, error } = await supabase
        .from("dive_media")
        .select("*")
        .eq("dive_id", diveId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as DiveMediaRow[]).map(mapMedia);
    },
  });
}

export type UploadInput = {
  localUri: string;
  kind: "image" | "video";
  contentType: string;
  originalFilename: string;
  thumbnailUri?: string | null;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
};

export function useUploadDiveMedia(diveId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadInput) => {
      if (!diveId) throw new Error("diveId required");

      const uploaded = await mediaStorage.upload({
        scope: { type: "dive", diveId },
        localUri: input.localUri,
        originalFilename: input.originalFilename,
        contentType: input.contentType,
        kind: input.kind,
      });

      const { error } = await supabase.from("dive_media").insert({
        dive_id: diveId,
        storage_url: uploaded.url,
        kind: input.kind,
        provider: uploaded.provider,
        file_size_bytes: uploaded.sizeBytes,
        original_filename: uploaded.filename,
        thumbnail_url: input.thumbnailUri ?? null,
        duration_seconds: input.durationSeconds ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dive-media", diveId] });
    },
  });
}
