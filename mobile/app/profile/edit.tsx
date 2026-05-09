import { useEffect, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { X, Camera, Award, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useProfile } from "@/src/hooks/use-profile";
import {
  useUpdateProfile,
  useUploadAvatar,
} from "@/src/hooks/use-update-profile";
import { useCertifications } from "@/src/hooks/use-certifications";
import {
  Avatar,
  AvatarCropModal,
  KeyboardSafeScroll,
} from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

export default function ProfileEditScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: profile } = useProfile(userId);
  const { data: certs } = useCertifications(userId);
  const update = useUpdateProfile(userId);
  const uploadAvatar = useUploadAvatar(userId);

  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [priorDives, setPriorDives] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cropUri, setCropUri] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? "");
      setBio(profile.bio ?? "");
      setPriorDives(
        profile.total_dives_at_signup != null
          ? String(profile.total_dives_at_signup)
          : "",
      );
    }
  }, [profile]);

  const onPickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("권한 필요", "사진 라이브러리 접근 권한을 허용해주세요.");
      return;
    }
    // 자체 크롭 모달에서 원형 가이드를 보여주기 위해 OS 기본 크롭은 끔.
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;
    setCropUri(asset.uri);
  };

  const onCropConfirm = async (croppedUri: string, contentType: string) => {
    setCropUri(null);
    try {
      await uploadAvatar.mutateAsync({
        localUri: croppedUri,
        contentType,
      });
    } catch (err: unknown) {
      showAlert("프로필 사진 업로드 실패", friendlyError(err));
    }
  };

  const onSave = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      showAlert("닉네임", "최소 2자 이상이어야 해요.");
      return;
    }
    let priorDivesValue: number | null = null;
    const priorDivesTrimmed = priorDives.trim();
    if (priorDivesTrimmed) {
      const n = Number(priorDivesTrimmed);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        showAlert("이전 다이브 수", "0 이상의 정수를 입력해주세요.");
        return;
      }
      priorDivesValue = n;
    }
    setSubmitting(true);
    try {
      await update.mutateAsync({
        nickname: trimmed,
        bio: bio.trim() || null,
        totalDivesAtSignup: priorDivesValue,
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
          <Text className="text-2xl font-bold text-gray-900">프로필 편집</Text>
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
                <ActivityIndicator size="small" color={colors.brand.fg} />
              ) : (
                <Camera size={14} color={colors.brand.fg} />
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

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">
            이전 다이브 수
          </Text>
          <TextInput
            value={priorDives}
            onChangeText={setPriorDives}
            placeholder="가입 전까지의 누적 다이브 수"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />
          <Text className="text-[10px] text-gray-400 mt-1 leading-4">
            앱 가입 전 기록된 누적 횟수예요. 다이브 컴퓨터로 인증/가져오기를
            진행하면서 중복이 생기지 않도록 직접 조정할 수 있어요.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/profile/cards" as never)}
          disabled={submitting}
          className="flex-row items-center justify-between bg-gray-50 rounded-2xl p-4"
        >
          <View className="flex-row items-center gap-3 flex-1">
            <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center">
              <Award size={16} color={colors.brand[700]} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-black text-gray-900">
                자격증 카드
              </Text>
              <Text className="text-[10px] text-gray-500 mt-0.5">
                {certs && certs.length > 0
                  ? `${certs.length}개 등록됨${
                      certs.find((c) => c.is_primary)
                        ? ` · 대표: ${certs.find((c) => c.is_primary)!.organization} ${certs.find((c) => c.is_primary)!.level}`
                        : ""
                    }`
                  : "촬영해서 등록하기"}
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color="#9CA3AF" />
        </Pressable>

        <Pressable
          onPress={onSave}
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

      <AvatarCropModal
        visible={cropUri !== null}
        uri={cropUri}
        onCancel={() => setCropUri(null)}
        onConfirm={onCropConfirm}
      />
    </SafeAreaView>
  );
}
