import { useEffect, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { X, ImagePlus } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useFeed, useUpdateFeed } from "@/src/hooks/use-feeds";
import { useUploadFeedImage } from "@/src/hooks/use-upload-feed-image";
import { KeyboardSafeScroll } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

const guessContentType = (uri: string): string => {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
};

export default function EditFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: feed, isLoading } = useFeed(id, userId);
  const updateFeed = useUpdateFeed(userId);
  const uploadImage = useUploadFeedImage(userId);

  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  // Image state:
  //  - imageLocalUri: a NEW image picked from gallery (uploads on save)
  //  - keptImageUrl: the existing image kept as-is (no upload, no delete)
  //  - if both null → user removed the image entirely
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [imageContentType, setImageContentType] = useState<string | null>(null);
  const [keptImageUrl, setKeptImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (feed) {
      setContent(feed.content ?? "");
      setLocation(feed.location ?? "");
      setKeptImageUrl(feed.imageUrl);
    }
  }, [feed]);

  const onPickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("권한 필요", "사진 라이브러리 접근 권한을 허용해주세요.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;
    setImageLocalUri(asset.uri);
    setImageContentType(asset.mimeType ?? guessContentType(asset.uri));
    setKeptImageUrl(null);
  };

  const onClearImage = () => {
    setImageLocalUri(null);
    setImageContentType(null);
    setKeptImageUrl(null);
  };

  const onSubmit = async () => {
    if (!feed) return;
    const trimmed = content.trim();
    if (trimmed.length < 1 && !imageLocalUri && !keptImageUrl) {
      showAlert("내용", "글 내용 또는 이미지를 추가해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      let nextImageUrl: string | null = keptImageUrl;
      if (imageLocalUri && imageContentType) {
        nextImageUrl = await uploadImage.mutateAsync({
          localUri: imageLocalUri,
          contentType: imageContentType,
        });
      }

      await updateFeed.mutateAsync({
        feedId: feed.id,
        content: trimmed,
        location: location.trim() || null,
        imageUrl: nextImageUrl,
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

  const previewUri = imageLocalUri ?? keptImageUrl;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-black text-gray-900">글 수정</Text>
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

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">사진 (선택)</Text>
          {previewUri ? (
            <View className="relative">
              <Image
                source={{ uri: previewUri }}
                className="w-full h-56 rounded-2xl"
                resizeMode="cover"
              />
              <Pressable
                onPress={onClearImage}
                disabled={submitting}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color="#fff" />
              </Pressable>
              <Pressable
                onPress={onPickImage}
                disabled={submitting}
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: "rgba(0,0,0,0.6)",
                }}
              >
                <Text className="text-white text-[10px] font-black">교체</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={onPickImage}
              disabled={submitting}
              className="border border-dashed border-gray-300 rounded-2xl py-8 items-center justify-center gap-2"
            >
              <ImagePlus size={20} color="#6B7280" />
              <Text className="text-xs font-bold text-gray-500">사진 추가</Text>
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
            <Text className="text-brand-fg font-black">저장</Text>
          )}
        </Pressable>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
