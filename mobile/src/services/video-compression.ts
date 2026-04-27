import { Video } from "react-native-compressor";
import * as VideoThumbnails from "expo-video-thumbnails";

export type CompressedVideo = {
  uri: string;
  thumbnailUri: string;
  durationSeconds?: number;
};

// Compress a video to ~1080p H.264 before upload. Targets ~30 MB/min.
// Original 4K@60fps source is reduced ~10-15x for upload viability.
export async function compressVideoForUpload(
  inputUri: string,
  onProgress?: (progress: number) => void,
): Promise<CompressedVideo> {
  const compressedUri = await Video.compress(
    inputUri,
    {
      compressionMethod: "auto",
      maxSize: 1920,        // longer-side resolution cap (1080p)
      bitrate: 4_000_000,   // 4 Mbps — good 1080p quality
      // keep 30fps default
    },
    (progress) => onProgress?.(progress),
  );

  // Extract a thumbnail at 1s for use in feed/logbook lists
  const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
    compressedUri,
    { time: 1000, quality: 0.7 },
  );

  return { uri: compressedUri, thumbnailUri };
}
