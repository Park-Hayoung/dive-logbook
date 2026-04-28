import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Users,
  Crown,
  UserPlus,
  UserMinus,
  Check,
  X,
  Hourglass,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useTeam,
  useTeamMembers,
  useRequestJoinTeam,
  useLeaveTeam,
  useApproveTeamMember,
  useRejectTeamMember,
} from "@/src/hooks/use-teams";

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: team, isLoading: teamLoading } = useTeam(id);
  const { data: members = [], isLoading: membersLoading } = useTeamMembers(id);
  const requestJoin = useRequestJoinTeam(userId);
  const leave = useLeaveTeam(userId);
  const approve = useApproveTeamMember();
  const reject = useRejectTeamMember();

  const myMembership = useMemo(
    () => members.find((m) => m.userId === userId),
    [members, userId],
  );
  const isLeader = myMembership?.role === "leader";
  const isMember = myMembership?.role === "member";
  const isPending = myMembership?.role === "pending";

  const pendingMembers = members.filter((m) => m.role === "pending");
  const approvedMembers = members.filter(
    (m) => m.role === "leader" || m.role === "member",
  );

  const onRequestJoin = async () => {
    if (!id) return;
    try {
      await requestJoin.mutateAsync(id);
      Alert.alert("신청 완료", "리더 승인 후 팀에 참여됩니다.");
    } catch (err: unknown) {
      Alert.alert(
        "신청 실패",
        err instanceof Error ? err.message : "알 수 없는 오류",
      );
    }
  };

  const onLeave = () => {
    if (!id) return;
    Alert.alert("팀 떠나기", "정말로 이 팀에서 나가시겠어요?", [
      { text: "취소" },
      {
        text: "나가기",
        style: "destructive",
        onPress: async () => {
          try {
            await leave.mutateAsync(id);
            router.back();
          } catch (err: unknown) {
            Alert.alert(
              "처리 실패",
              err instanceof Error ? err.message : "알 수 없는 오류",
            );
          }
        },
      },
    ]);
  };

  const onApprove = (memberUserId: string) => {
    if (!id) return;
    approve.mutate({ teamId: id, userId: memberUserId });
  };
  const onReject = (memberUserId: string) => {
    if (!id) return;
    reject.mutate({ teamId: id, userId: memberUserId });
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
      <SafeAreaView edges={["top"]} className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-gray-400 mb-4">팀을 찾을 수 없습니다.</Text>
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
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base flex-1">팀</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <View className="bg-white p-6 rounded-3xl items-center mb-4">
          <View className="w-20 h-20 rounded-3xl bg-brand-50 items-center justify-center mb-3">
            {team.imageUrl ? (
              <Image
                source={{ uri: team.imageUrl }}
                className="w-20 h-20 rounded-3xl"
              />
            ) : (
              <Users size={32} color="#2563EB" />
            )}
          </View>
          <Text className="text-2xl font-black text-gray-900 mb-1">
            {team.name}
          </Text>
          <Text className="text-[10px] text-gray-400 font-bold mb-3">
            멤버 {approvedMembers.length}명
          </Text>
          {team.description ? (
            <Text className="text-sm text-gray-700 text-center leading-5 mb-4">
              {team.description}
            </Text>
          ) : null}

          {!myMembership ? (
            <Pressable
              onPress={onRequestJoin}
              disabled={requestJoin.isPending}
              className="flex-row items-center gap-2 bg-brand-600 px-5 py-3 rounded-2xl"
            >
              {requestJoin.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <UserPlus size={14} color="#fff" />
              )}
              <Text className="text-white font-black text-sm">
                가입 신청
              </Text>
            </Pressable>
          ) : isPending ? (
            <View className="flex-row items-center gap-2 bg-amber-50 px-4 py-2 rounded-2xl">
              <Hourglass size={12} color="#D97706" />
              <Text className="text-xs font-black text-amber-700">
                승인 대기 중
              </Text>
            </View>
          ) : isLeader ? (
            <View className="flex-row items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-full">
              <Crown size={12} color="#D97706" />
              <Text className="text-[10px] font-black text-amber-700">
                리더
              </Text>
            </View>
          ) : isMember ? (
            <Pressable
              onPress={onLeave}
              disabled={leave.isPending}
              className="flex-row items-center gap-2 bg-gray-100 px-4 py-2 rounded-2xl"
            >
              <UserMinus size={12} color="#374151" />
              <Text className="text-xs font-black text-gray-700">
                팀 떠나기
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isLeader && pendingMembers.length > 0 ? (
          <View className="mb-4">
            <Text className="text-[10px] font-black text-gray-400 uppercase mb-2 px-1">
              승인 대기 {pendingMembers.length}
            </Text>
            <View className="gap-2">
              {pendingMembers.map((m) => (
                <View
                  key={m.userId}
                  className="bg-white p-3 rounded-2xl flex-row items-center gap-3"
                >
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/profile/[id]",
                        params: { id: m.userId },
                      })
                    }
                    className="flex-row items-center gap-3 flex-1 min-w-0"
                  >
                    <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center">
                      {m.profile?.profileImageUrl ? (
                        <Image
                          source={{ uri: m.profile.profileImageUrl }}
                          className="w-9 h-9 rounded-full"
                        />
                      ) : (
                        <Text className="text-sm font-black text-brand-600">
                          {m.profile?.nickname?.charAt(0) ?? "?"}
                        </Text>
                      )}
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text
                        className="font-black text-sm text-gray-900"
                        numberOfLines={1}
                      >
                        {m.profile?.nickname ?? "Unknown"}
                      </Text>
                      <Text className="text-[10px] text-gray-400">
                        {m.profile?.certification ?? ""}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => onApprove(m.userId)}
                    disabled={approve.isPending}
                    hitSlop={6}
                    className="w-9 h-9 rounded-full bg-emerald-50 items-center justify-center"
                  >
                    <Check size={14} color="#059669" />
                  </Pressable>
                  <Pressable
                    onPress={() => onReject(m.userId)}
                    disabled={reject.isPending}
                    hitSlop={6}
                    className="w-9 h-9 rounded-full bg-red-50 items-center justify-center"
                  >
                    <X size={14} color="#DC2626" />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text className="text-[10px] font-black text-gray-400 uppercase mb-2 px-1">
          멤버 {approvedMembers.length}
        </Text>
        {membersLoading ? (
          <ActivityIndicator />
        ) : (
          <View className="gap-2">
            {approvedMembers.map((m) => (
              <Pressable
                key={m.userId}
                onPress={() =>
                  router.push({
                    pathname: "/profile/[id]",
                    params: { id: m.userId },
                  })
                }
                className="bg-white p-3 rounded-2xl flex-row items-center gap-3"
              >
                <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
                  {m.profile?.profileImageUrl ? (
                    <Image
                      source={{ uri: m.profile.profileImageUrl }}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <Text className="text-sm font-black text-brand-600">
                      {m.profile?.nickname?.charAt(0) ?? "?"}
                    </Text>
                  )}
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1.5">
                    <Text
                      className="font-black text-sm text-gray-900"
                      numberOfLines={1}
                    >
                      {m.profile?.nickname ?? "Unknown"}
                    </Text>
                    {m.role === "leader" ? (
                      <Crown size={11} color="#D97706" />
                    ) : null}
                  </View>
                  <Text className="text-[10px] text-gray-400">
                    {m.profile?.certification ?? ""}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
