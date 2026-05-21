import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import type { MediaProvider } from "@/src/types/dive";

export type BoardMedia = {
  id: string;
  postId: string;
  storageUrl: string;
  kind: "image" | "video";
  provider: MediaProvider;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  uploadedAt: string;
};

type Row = {
  id: string;
  post_id: string;
  storage_url: string;
  kind: "image" | "video";
  provider: MediaProvider;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  uploaded_at: string;
};

const mapBoardMedia = (row: Row): BoardMedia => ({
  id: row.id,
  postId: row.post_id,
  storageUrl: row.storage_url,
  kind: row.kind,
  provider: row.provider,
  thumbnailUrl: row.thumbnail_url,
  durationSeconds: row.duration_seconds,
  width: row.width,
  height: row.height,
  uploadedAt: row.uploaded_at,
});

export function useBoardMedia(postId: string | undefined) {
  return useQuery({
    queryKey: ["board-media", postId],
    enabled: !!postId,
    queryFn: async (): Promise<BoardMedia[]> => {
      const { data, error } = await supabase
        .from("board_post_media")
        .select("*")
        .eq("post_id", postId!)
        .order("uploaded_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Row[]).map(mapBoardMedia);
    },
  });
}
