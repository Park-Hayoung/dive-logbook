import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useCreateTeam } from "@/src/hooks/use-teams";
import { KeyboardSafeScroll } from "@/src/components";

export default function NewTeamScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const create = useCreateTeam(userId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const n = name.trim();
    if (n.length < 2) {
      Alert.alert("팀 이름", "최소 2자 이상이어야 합니다.");
      return;
    }
    setSubmitting(true);
    try {
      const teamId = await create.mutateAsync({
        name: n,
        description: description.trim() || null,
      });
      router.replace({ pathname: "/team/[id]", params: { id: teamId } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      Alert.alert("팀 생성 실패", message);
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
          팀을 만들면 자동으로 리더가 됩니다.
        </Text>

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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-black">팀 만들기</Text>
          )}
        </Pressable>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
