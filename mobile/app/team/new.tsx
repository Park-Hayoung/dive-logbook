import { useMemo, useState } from "react";
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
import * as Crypto from "expo-crypto";
import { X, Camera, Users } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useCreateTeam } from "@/src/hooks/use-teams";
import { useUploadTeamImage } from "@/src/hooks/use-upload-team-image";
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

export default function NewTeamScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const create = useCreateTeam(userId);
  const uploadImage = useUploadTeamImage(userId);

  // Generate a teamId up front so we can upload the image under teams/<id>/
  // before the row exists in the DB.
  const teamId = useMemo(() => Crypto.randomUUID(), []);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [imageContentType, setImageContentType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onPickImage = async () => {
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
    setImageLocalUri(asset.uri);
    setImageContentType(asset.mimeType ?? guessContentType(asset.uri));
  };

  const onSubmit = async () => {
    const n = name.trim();
    if (n.length < 2) {
      showAlert("팀 이름", "최소 2자 이상이어야 해요.");
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageLocalUri && imageContentType) {
        imageUrl = await uploadImage.mutateAsync({
          teamId,
          localUri: imageLocalUri,
          contentType: imageContentType,
        });
      }
      await create.mutateAsync({
        id: teamId,
        name: n,
        description: description.trim() || null,
        imageUrl,
      });
      router.replace({ pathname: "/team/[id]", params: { id: teamId } });
    } catch (err: unknown) {
      showAlert("팀 생성 실패", friendlyError(err));
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
          <Text className="text-2xl font-black text-gray-900">팀 만들기</Text>
          <Pressable
            onPress={() => router.back()}
            className="p-2 bg-gray-100 rounded-full"
            disabled={submitting}
          >
            <X size={20} color="#374151" />
          </Pressable>
        </View>

        <Text className="text-xs text-gray-500">
          팀을 만들면 자동으로 리더가 돼요.
        </Text>

        <View className="items-center my-2">
          <Pressable
            onPress={onPickImage}
            disabled={submitting}
            style={{ width: 96, height: 96 }}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 28,
                backgroundColor: colors.brand[50],
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {imageLocalUri ? (
                <Image
                  source={{ uri: imageLocalUri }}
                  style={{ width: 96, height: 96 }}
                  resizeMode="cover"
                />
              ) : (
                <Users size={32} color={colors.brand[700]} />
              )}
            </View>
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.brand[600],
                borderWidth: 2,
                borderColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={14} color={colors.brand.fg} />
            </View>
          </Pressable>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">팀 이름 *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="예: Bohol Divers Korea"
            placeholderTextColor="#9CA3AF"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">소개</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="팀 소개 / 활동 지역 / 모집 자격 등"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 min-h-24"
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
            <Text className="text-brand-fg font-black">팀 만들기</Text>
          )}
        </Pressable>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
