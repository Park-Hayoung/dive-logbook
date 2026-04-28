import * as ImagePicker from "expo-image-picker";
import { mediaStorage } from "./media-storage";
import { compressVideoForUpload } from "./video-compression";
import type { UploadResult } from "./media-storage";

export async function pickAndUploadImage(diveId: string): Promise<UploadResult | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  return mediaStorage.upload({
    scope: { type: "dive", diveId },
    localUri: asset.uri,
    originalFilename: asset.fileName ?? "image.jpg",
    contentType: asset.mimeType ?? "image/jpeg",
    kind: "image",
  });
}

export async function pickAndUploadVideo(
  diveId: string,
  onCompressProgress?: (progress: number) => void,
): Promise<{ video: UploadResult; thumbnail: UploadResult } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  const compressed = await compressVideoForUpload(asset.uri, onCompressProgress);

  const [video, thumbnail] = await Promise.all([
    mediaStorage.upload({
      scope: { type: "dive", diveId },
      localUri: compressed.uri,
      originalFilename: asset.fileName ?? "video.mp4",
      contentType: "video/mp4",
      kind: "video",
    }),
    mediaStorage.upload({
      scope: { type: "dive", diveId },
      localUri: compressed.thumbnailUri,
      originalFilename: "thumbnail.jpg",
      contentType: "image/jpeg",
      kind: "image",
    }),
  ]);

  return { video, thumbnail };
}
