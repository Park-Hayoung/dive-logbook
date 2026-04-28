import { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  Linking,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, Play, X, ExternalLink } from "lucide-react-native";

import {
  useDiveMedia,
  useUploadDiveMedia,
} from "@/src/hooks/use-dive-media";
import type { DiveMedia } from "@/src/types/dive";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

type Props = { diveId: string };

const guessContentType = (uri: string, kind: "image" | "video"): string => {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  if (kind === "video") {
    if (ext === "mov") return "video/quicktime";
    if (ext === "m4v") return "video/x-m4v";
    return "video/mp4";
  }
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
};

const filenameFrom = (uri: string, fallbackKind: "image" | "video"): string => {
  const last = uri.split("/").pop();
  if (last && last.includes(".")) return last;
  const ext = fallbackKind === "video" ? "mp4" : "jpg";
  return `${Date.now()}.${ext}`;
};

async function tryCompressVideo(
  uri: string,
): Promise<{ uri: string; thumbnailUri: string | null }> {
  try {
    const mod = await import("@/src/services/video-compression");
    const result = await mod.compressVideoForUpload(uri);
    return { uri: result.uri, thumbnailUri: result.thumbnailUri };
  } catch {
    return { uri, thumbnailUri: null };
  }
}

export function DiveMediaGallery({ diveId }: Props) {
  const { data: media = [], isLoading } = useDiveMedia(diveId);
  const upload = useUploadDiveMedia(diveId);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<DiveMedia | null>(null);

  const onPickAndUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("권한 필요", "사진 라이브러리 접근 권한을 허용해주세요.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.9,
      videoMaxDuration: 300,
    });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    if (!asset) return;

    const kind: "image" | "video" =
      asset.type === "video" ? "video" : "image";

    setBusy(true);
    try {
      let uploadUri = asset.uri;
      let thumbnailUri: string | null = null;

      if (kind === "video") {
        const compressed = await tryCompressVideo(asset.uri);
        uploadUri = compressed.uri;
        thumbnailUri = compressed.thumbnailUri;
      }

      await upload.mutateAsync({
        localUri: uploadUri,
        kind,
        contentType: asset.mimeType ?? guessContentType(uploadUri, kind),
        originalFilename: asset.fileName ?? filenameFrom(uploadUri, kind),
        thumbnailUri,
        durationSeconds:
          kind === "video" && typeof asset.duration === "number"
            ? Math.round(asset.duration / 1000)
            : null,
        width: asset.width ?? null,
        height: asset.height ?? null,
      });
    } catch (err: unknown) {
      showAlert("업로드 실패", friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="bg-white p-5 rounded-3xl border border-gray-100">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-[10px] font-black text-gray-400 uppercase">
          사진 / 영상
        </Text>
        <Pressable
          onPress={onPickAndUpload}
          disabled={busy}
          className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full"
        >
          {busy ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <ImagePlus size={12} color="#2563EB" />
          )}
          <Text className="text-[10px] font-black text-brand-700">
            {busy ? "업로드 중" : "추가"}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator />
      ) : media.length === 0 ? (
        <Text className="text-xs text-gray-400">
          아직 등록된 사진/영상이 없어요.
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {media.map((m) => {
            const thumb = m.thumbnailUrl ?? m.storageUrl;
            return (
              <Pressable
                key={m.id}
                onPress={() => setViewer(m)}
                className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 active:opacity-70"
              >
                <Image
                  source={{ uri: thumb }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                {m.kind === "video" ? (
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="w-8 h-8 rounded-full bg-black/50 items-center justify-center">
                      <Play size={14} color="#fff" />
                    </View>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <MediaViewerModal media={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

function MediaViewerModal({
  media,
  onClose,
}: {
  media: DiveMedia | null;
  onClose: () => void;
}) {
  const { width, height } = Dimensions.get("window");

  return (
    <Modal
      visible={!!media}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/95 items-center justify-center">
        <Pressable
          onPress={onClose}
          className="absolute top-12 right-5 z-10 w-10 h-10 rounded-full bg-white/15 items-center justify-center"
          hitSlop={12}
        >
          <X size={22} color="#fff" />
        </Pressable>

        {media ? (
          media.kind === "image" ? (
            <Image
              source={{ uri: media.storageUrl }}
              style={{ width, height: height * 0.85 }}
              resizeMode="contain"
            />
          ) : (
            <View className="items-center gap-4 px-8">
              <Image
                source={{ uri: media.thumbnailUrl ?? media.storageUrl }}
                style={{ width: width * 0.8, height: width * 0.8 }}
                resizeMode="contain"
                className="rounded-3xl"
              />
              <Pressable
                onPress={() => Linking.openURL(media.storageUrl)}
                className="flex-row items-center gap-2 bg-brand-600 px-5 py-3 rounded-2xl"
              >
                <ExternalLink size={16} color="#fff" />
                <Text className="text-white font-black text-sm">
                  영상 재생 (외부 앱)
                </Text>
              </Pressable>
              <Text className="text-white/60 text-[10px] mt-2">
                인앱 비디오 플레이어는 EAS Build에서 추가 예정
              </Text>
            </View>
          )
        ) : null}
      </View>
    </Modal>
  );
}
