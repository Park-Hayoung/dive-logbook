import { useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { X, ImagePlus, Play } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useCreateFeed, type FeedMediaInsert } from "@/src/hooks/use-feeds";
import { mediaStorage } from "@/src/services/media-storage";
import { KeyboardSafeScroll } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

type PickedMedia = {
  /** Stable key for list rendering. */
  key: string;
  localUri: string;
  contentType: string;
  kind: "image" | "video";
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
};

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

const filenameFrom = (uri: string, kind: "image" | "video"): string => {
  const last = uri.split("/").pop();
  if (last && last.includes(".")) return last;
  const ext = kind === "video" ? "mp4" : "jpg";
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

export default function NewFeedScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const createFeed = useCreateFeed(userId);

  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [picked, setPicked] = useState<PickedMedia[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const onPickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("권한 필요", "사진 라이브러리 접근 권한을 허용해주세요.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.85,
      videoMaxDuration: 300,
    });
    if (result.canceled) return;
    const next: PickedMedia[] = result.assets.map((a) => {
      const kind: "image" | "video" =
        a.type === "video" ? "video" : "image";
      return {
        key: `${a.uri}::${a.assetId ?? Date.now()}`,
        localUri: a.uri,
        contentType: a.mimeType ?? guessContentType(a.uri, kind),
        kind,
        durationSeconds:
          kind === "video" && typeof a.duration === "number"
            ? Math.round(a.duration / 1000)
            : null,
        width: a.width ?? null,
        height: a.height ?? null,
      };
    });
    setPicked((prev) => [...prev, ...next]);
  };

  const onRemove = (key: string) => {
    setPicked((prev) => prev.filter((p) => p.key !== key));
  };

  const onSubmit = async () => {
    if (picked.length === 0) {
      showAlert(
        "사진 필요",
        "피드에는 사진 또는 영상을 한 장 이상 첨부해야 해요.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const uploaded: FeedMediaInsert[] = [];
      for (const item of picked) {
        let uploadUri = item.localUri;
        let thumbnailUrl: string | null = null;

        if (item.kind === "video") {
          const compressed = await tryCompressVideo(item.localUri);
          uploadUri = compressed.uri;
          if (compressed.thumbnailUri) {
            try {
              const thumb = await mediaStorage.upload({
                scope: { type: "feed" },
                localUri: compressed.thumbnailUri,
                originalFilename: `thumb-${Date.now()}.jpg`,
                contentType: "image/jpeg",
                kind: "image",
              });
              thumbnailUrl = thumb.url;
            } catch (e) {
              console.warn("feed thumbnail upload failed", e);
            }
          }
        }

        const result = await mediaStorage.upload({
          scope: { type: "feed" },
          localUri: uploadUri,
          originalFilename: filenameFrom(uploadUri, item.kind),
          contentType: item.contentType,
          kind: item.kind,
        });

        uploaded.push({
          storageUrl: result.url,
          kind: item.kind,
          provider: result.provider,
          thumbnailUrl,
          durationSeconds: item.durationSeconds,
          width: item.width,
          height: item.height,
          fileSizeBytes: result.sizeBytes ?? null,
          originalFilename: result.filename ?? null,
        });
      }

      await createFeed.mutateAsync({
        content: content.trim(),
        type: "normal",
        location: location.trim() || null,
        media: uploaded,
      });
      router.back();
    } catch (err: unknown) {
      showAlert("작성 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-bold text-gray-900">새 글 작성</Text>
          <Pressable
            onPress={() => router.back()}
            className="p-2 bg-gray-100 rounded-full"
            disabled={submitting}
          >
            <X size={20} color="#374151" />
          </Pressable>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">내용</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="오늘의 다이브 인상, 본 어종, 추천 포인트 등"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 min-h-32"
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-bold text-gray-700">사진 / 영상 *</Text>
          {picked.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {picked.map((item) => (
                <View key={item.key} className="relative">
                  <View className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-200">
                    <Image
                      source={{ uri: item.localUri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    {item.kind === "video" ? (
                      <View
                        style={{
                          position: "absolute",
                          inset: 0,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(0,0,0,0.25)",
                        }}
                      >
                        <Play size={20} color="#fff" />
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => onRemove(item.key)}
                    disabled={submitting}
                    hitSlop={6}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={onPickMedia}
                disabled={submitting}
                className="w-24 h-24 rounded-2xl border border-dashed border-gray-300 items-center justify-center gap-1"
              >
                <ImagePlus size={18} color="#6B7280" />
                <Text className="text-[10px] font-bold text-gray-500">
                  더 추가
                </Text>
              </Pressable>
            </ScrollView>
          ) : (
            <Pressable
              onPress={onPickMedia}
              disabled={submitting}
              className="border border-dashed border-gray-300 rounded-2xl py-8 items-center justify-center gap-2"
            >
              <ImagePlus size={20} color="#6B7280" />
              <Text className="text-xs font-bold text-gray-500">
                사진 / 영상 추가
              </Text>
              <Text className="text-[10px] text-gray-400">
                여러 개 선택 가능 (최대 10개)
              </Text>
            </Pressable>
          )}
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">위치 (선택)</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="제주도 서귀포"
            placeholderTextColor="#9CA3AF"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className="bg-brand-600 p-4 rounded-2xl items-center mt-2"
        >
          {submitting ? (
            <ActivityIndicator color={colors.brand.fg} />
          ) : (
            <Text className="text-brand-fg font-black">올리기</Text>
          )}
        </Pressable>

        <Text className="text-[10px] text-gray-400 text-center mt-2">
          업로드 중에는 화면을 떠나지 마세요.
        </Text>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
