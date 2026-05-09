import { useEffect, useMemo, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Trash2 } from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useTeam,
  useTeamMembers,
  useUpdateTeam,
  useDeleteTeam,
} from "@/src/hooks/use-teams";
import { KeyboardSafeScroll } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

export default function TeamEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: team, isLoading: teamLoading } = useTeam(id);
  const { data: members = [] } = useTeamMembers(id);
  const update = useUpdateTeam();
  const del = useDeleteTeam();

  const isLeader = useMemo(
    () =>
      members.find((m) => m.userId === userId)?.role === "leader" ||
      team?.leaderId === userId,
    [members, userId, team?.leaderId],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setDescription(team.description ?? "");
    }
  }, [team]);

  const onSave = async () => {
    if (!id) return;
    const n = name.trim();
    if (n.length < 2) {
      showAlert("팀 이름", "최소 2자 이상이어야 해요.");
      return;
    }
    setSubmitting(true);
    try {
      await update.mutateAsync({
        teamId: id,
        name: n,
        description: description.trim() || null,
      });
      router.back();
    } catch (err: unknown) {
      showAlert("저장 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = () => {
    if (!id) return;
    showAlert(
      "팀 삭제",
      "팀을 삭제하면 모든 멤버가 자동으로 해제돼요.\n이 작업은 되돌릴 수 없어요.",
      [
        { text: "취소" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              await del.mutateAsync(id);
              router.replace("/team");
            } catch (err: unknown) {
              showAlert("삭제 실패", friendlyError(err));
            }
          },
        },
      ],
    );
  };

  if (teamLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!team) {
    return (
      <SafeAreaView
        edges={["top"]}
        className="flex-1 items-center justify-center bg-gray-50 p-6"
      >
        <Text className="text-gray-400 mb-4">팀을 찾을 수 없어요.</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-gray-900 px-5 py-3 rounded-2xl"
        >
          <Text className="text-white font-black">돌아가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!isLeader) {
    return (
      <SafeAreaView
        edges={["top"]}
        className="flex-1 items-center justify-center bg-gray-50 p-6"
      >
        <Text className="text-gray-400 mb-4">리더만 팀을 수정할 수 있어요.</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-gray-900 px-5 py-3 rounded-2xl"
        >
          <Text className="text-white font-black">돌아가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
          disabled={submitting}
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base flex-1">팀 수정</Text>
        <Pressable
          onPress={onSave}
          disabled={submitting}
          hitSlop={8}
          className="px-4 py-2 rounded-full bg-brand-600"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.brand.fg} />
          ) : (
            <Text className="text-brand-fg font-black text-xs">저장</Text>
          )}
        </Pressable>
      </View>

      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
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

        <Text className="text-[10px] text-gray-400 mt-1">
          팀 이미지는 팀 상세 화면에서 변경할 수 있어요.
        </Text>

        <View className="mt-6 border-t border-gray-100 pt-6">
          <Text className="text-[10px] font-black text-gray-400 uppercase mb-2">
            위험 구역
          </Text>
          <Pressable
            onPress={onDelete}
            disabled={submitting || del.isPending}
            className="flex-row items-center justify-center gap-2 bg-red-50 border border-red-100 p-4 rounded-2xl"
          >
            {del.isPending ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Trash2 size={14} color="#DC2626" />
            )}
            <Text className="text-red-600 font-black text-sm">팀 삭제</Text>
          </Pressable>
          <Text className="text-[10px] text-gray-400 mt-2 leading-4">
            팀을 삭제하면 모든 멤버가 자동으로 해제되고, 이 작업은 되돌릴 수
            없어요.
          </Text>
        </View>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
