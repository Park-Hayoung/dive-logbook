import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { X, Camera } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useProfile } from "@/src/hooks/use-profile";
import {
  useUpdateProfile,
  useUploadAvatar,
} from "@/src/hooks/use-update-profile";
import { Avatar, KeyboardSafeScroll } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

const guessContentType = (uri: string): string => {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
};

export default function ProfileEditScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: profile } = useProfile(userId);
  const update = useUpdateProfile(userId);
  const uploadAvatar = useUploadAvatar(userId);

  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const onPickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("권한 필요", "사진 라이브러리 접근 권한을 허용해주세요.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;

    try {
      await uploadAvatar.mutateAsync({
        localUri: asset.uri,
        contentType: asset.mimeType ?? guessContentType(asset.uri),
      });
    } catch (err: unknown) {
      showAlert(
        "프로필 사진 업로드 실패",
        friendlyError(err),
      );
    }
  };

  const onSave = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      showAlert("닉네임", "최소 2자 이상이어야 해요.");
      return;
    }
    setSubmitting(true);
    try {
      await update.mutateAsync({
        nickname: trimmed,
        bio: bio.trim() || null,
      });
      router.back();
    } catch (err: unknown) {
      showAlert(
        "저장 실패",
        friendlyError(err),
      );
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
          <Text className="text-2xl font-black text-gray-900">프로필 편집</Text>
          <Pressable
            onPress={() => router.back()}
            disabled={submitting}
            className="p-2 bg-gray-100 rounded-full"
          >
            <X size={20} color="#374151" />
          </Pressable>
        </View>

        <View className="items-center my-4">
          <Pressable
            onPress={onPickAvatar}
            disabled={uploadAvatar.isPending || submitting}
            className="relative"
          >
            <Avatar
              uri={profile?.profile_image_url}
              name={profile?.nickname}
              size={96}
            />
            <View className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-600 items-center justify-center border-2 border-white">
              {uploadAvatar.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={14} color="#fff" />
              )}
            </View>
          </Pressable>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">닉네임 *</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="닉네임"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">소개</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="자신을 한 줄로 소개해보세요 (선택)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 min-h-24"
          />
        </View>

        <Pressable
          onPress={onSave}
          disabled={submitting}
          className="bg-brand-600 p-4 rounded-2xl items-center mt-2"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-black">저장</Text>
          )}
        </Pressable>

        <Text className="text-[10px] text-gray-400 text-center mt-2">
          자격등급 · 단체 변경은 추후 추가
        </Text>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
