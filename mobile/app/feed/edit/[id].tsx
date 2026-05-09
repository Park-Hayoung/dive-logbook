import { useEffect, useMemo, useState } from "react";
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
import { X, ImagePlus, ExternalLink, Play } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useFeed, useUpdateFeed } from "@/src/hooks/use-feeds";
import {
  useFeedMedia,
  useUploadFeedMedia,
  useDeleteFeedMedia,
} from "@/src/hooks/use-feed-media";
import { KeyboardSafeScroll } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

type ExistingItem = {
  kind: "existing";
  id: string;
  /** True for the legacy single-image feed (no feed_media row, only feeds.image_url). */
  isLegacyCover: boolean;
  uri: string;
  mediaKind: "image" | "video";
  thumbnailUrl: string | null;
};
type NewItem = {
  kind: "new";
  key: string;
  localUri: string;
  contentType: string;
  mediaKind: "image" | "video";
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
};
type Item = ExistingItem | NewItem;

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

export default function EditFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: feed, isLoading } = useFeed(id, userId);
  const updateFeed = useUpdateFeed(userId);
  const isLogShare = !!feed?.linkedDiveId;
  const { data: existingMedia = [] } = useFeedMedia(
    !isLogShare ? feed?.id : undefined,
  );
  const uploadMedia = useUploadFeedMedia();
  const deleteMedia = useDeleteFeedMedia(feed?.id);

  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Initialize media items once feed + media load.
  useEffect(() => {
    if (!feed) return;
    setContent(feed.content ?? "");
    setLocation(feed.location ?? "");
    if (isLogShare) {
      setItems([]);
      return;
    }
    if (existingMedia.length > 0) {
      setItems(
        existingMedia.map<ExistingItem>((m) => ({
          kind: "existing",
          id: m.id,
          isLegacyCover: false,
          uri: m.storageUrl,
          mediaKind: m.kind,
          thumbnailUrl: m.thumbnailUrl,
        })),
      );
    } else if (feed.imageUrl) {
      setItems([
        {
          kind: "existing",
          id: "legacy-cover",
          isLegacyCover: true,
          uri: feed.imageUrl,
          mediaKind: "image",
          thumbnailUrl: null,
        },
      ]);
    } else {
      setItems([]);
    }
  }, [feed, existingMedia, isLogShare]);

  const originalExistingIds = useMemo(() => {
    const set = new Set<string>();
    existingMedia.forEach((m) => set.add(m.id));
    return set;
  }, [existingMedia]);

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
    const next: NewItem[] = result.assets.map((a) => {
      const kind: "image" | "video" =
        a.type === "video" ? "video" : "image";
      return {
        kind: "new",
        key: `${a.uri}::${a.assetId ?? Date.now()}`,
        localUri: a.uri,
        contentType: a.mimeType ?? guessContentType(a.uri, kind),
        mediaKind: kind,
        durationSeconds:
          kind === "video" && typeof a.duration === "number"
            ? Math.round(a.duration / 1000)
            : null,
        width: a.width ?? null,
        height: a.height ?? null,
      };
    });
    setItems((prev) => [...prev, ...next]);
  };

  const onRemoveItem = (target: Item) => {
    setItems((prev) =>
      prev.filter((it) =>
        target.kind === "existing"
          ? !(it.kind === "existing" && it.id === target.id)
          : !(it.kind === "new" && it.key === target.key),
      ),
    );
  };

  const onSubmit = async () => {
    if (!feed) return;

    if (!isLogShare && items.length === 0) {
      showAlert(
        "사진 필요",
        "피드에는 사진 또는 영상을 한 장 이상 첨부해야 해요.",
      );
      return;
    }

    setSubmitting(true);
    try {
      let newCoverUrl: string | null = null;
      let firstUploadedUrl: string | null = null;

      if (!isLogShare) {
        // 1) Determine which existing rows to delete.
        const keptExistingIds = new Set(
          items
            .filter((it) => it.kind === "existing" && !it.isLegacyCover)
            .map((it) => (it as ExistingItem).id),
        );
        const toDelete = [...originalExistingIds].filter(
          (id) => !keptExistingIds.has(id),
        );
        for (const mediaId of toDelete) {
          await deleteMedia.mutateAsync(mediaId);
        }

        // 2) Upload new picks in order.
        const uploadedItems: { it: NewItem; storageUrl: string }[] = [];
        for (const it of items) {
          if (it.kind !== "new") continue;
          const result = await uploadMedia.mutateAsync({
            feedId: feed.id,
            file: {
              localUri: it.localUri,
              kind: it.mediaKind,
              contentType: it.contentType,
              originalFilename: filenameFrom(it.localUri, it.mediaKind),
              durationSeconds: it.durationSeconds,
              width: it.width,
              height: it.height,
              ...(it.mediaKind === "video"
                ? await (async () => {
                    const c = await tryCompressVideo(it.localUri);
                    return { thumbnailUri: c.thumbnailUri };
                  })()
                : {}),
            },
          });
          uploadedItems.push({ it, storageUrl: result.storageUrl });
          if (!firstUploadedUrl) firstUploadedUrl = result.storageUrl;
        }

        // 3) Determine cover URL.
        // Priority: first kept existing row > first uploaded new item > null
        const firstExisting = items.find(
          (it) => it.kind === "existing" && !it.isLegacyCover,
        ) as ExistingItem | undefined;
        const legacyKept = items.some(
          (it) => it.kind === "existing" && it.isLegacyCover,
        );

        if (firstExisting) {
          newCoverUrl = firstExisting.uri;
        } else if (legacyKept && items[0]?.kind === "existing") {
          newCoverUrl = (items[0] as ExistingItem).uri;
        } else if (firstUploadedUrl) {
          newCoverUrl = firstUploadedUrl;
        } else {
          newCoverUrl = null;
        }
      } else {
        // Log-share feed: cover stays as-is.
        newCoverUrl = feed.imageUrl;
      }

      await updateFeed.mutateAsync({
        feedId: feed.id,
        content: content.trim(),
        location: location.trim() || null,
        imageUrl: newCoverUrl,
        previousImageUrl: feed.imageUrl,
      });
      router.back();
    } catch (err: unknown) {
      showAlert("수정 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !feed) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-bold text-gray-900">글 수정</Text>
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
            placeholder="글 내용"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 min-h-32"
          />
        </View>

        {isLogShare ? (
          <View className="gap-1">
            <Text className="text-xs font-bold text-gray-700">사진</Text>
            <View className="border border-gray-200 rounded-2xl p-4 gap-3">
              <Text className="text-xs text-gray-500 leading-4">
                이 글은 다이브 로그에 연결되어 있어요.{"\n"}
                사진과 영상은 연결된 로그에서 관리해요.
              </Text>
              <Pressable
                onPress={() =>
                  feed.linkedDiveId &&
                  router.push({
                    pathname: "/log/[id]",
                    params: { id: feed.linkedDiveId },
                  })
                }
                disabled={submitting}
                className="self-start flex-row items-center gap-1.5 bg-gray-100 px-4 py-2 rounded-xl"
              >
                <ExternalLink size={12} color="#374151" />
                <Text className="text-xs font-black text-gray-700">
                  로그 상세에서 사진 관리
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="gap-2">
            <Text className="text-xs font-bold text-gray-700">사진 / 영상 *</Text>
            {items.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {items.map((it) => {
                  const previewUri =
                    it.kind === "existing" ? it.uri : it.localUri;
                  const mediaKind =
                    it.kind === "existing" ? it.mediaKind : it.mediaKind;
                  const itemKey = it.kind === "existing" ? it.id : it.key;
                  return (
                    <View key={itemKey} className="relative">
                      <View className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-200">
                        <Image
                          source={{
                            uri:
                              it.kind === "existing" &&
                              it.mediaKind === "video" &&
                              it.thumbnailUrl
                                ? it.thumbnailUrl
                                : previewUri,
                          }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                        {mediaKind === "video" ? (
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
                        onPress={() => onRemoveItem(it)}
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
                  );
                })}
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
              </Pressable>
            )}
          </View>
        )}

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
            <Text className="text-brand-fg font-black">저장</Text>
          )}
        </Pressable>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
