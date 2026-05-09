import { useMemo, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
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
  Camera,
  Pencil,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useTeam,
  useTeamMembers,
  useRequestJoinTeam,
  useLeaveTeam,
  useApproveTeamMember,
  useRejectTeamMember,
  useUpdateTeam,
} from "@/src/hooks/use-teams";
import { useUploadTeamImage } from "@/src/hooks/use-upload-team-image";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

const guessContentType = (uri: string): string => {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
};

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
  const updateTeam = useUpdateTeam();
  const uploadImage = useUploadTeamImage(userId);
  const [imageBusy, setImageBusy] = useState(false);

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
      showAlert("신청 완료", "리더 승인 후 팀에 참여할 수 있어요.");
    } catch (err: unknown) {
      showAlert(
        "신청 실패",
        friendlyError(err),
      );
    }
  };

  const onLeave = () => {
    if (!id) return;
    showAlert("팀 떠나기", "정말로 이 팀에서 나가시겠어요?", [
      { text: "취소" },
      {
        text: "나가기",
        style: "destructive",
        onPress: async () => {
          try {
            await leave.mutateAsync(id);
            router.back();
          } catch (err: unknown) {
            showAlert(
              "처리 실패",
              friendlyError(err),
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

  const onChangeTeamImage = async () => {
    if (!id) return;
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

    setImageBusy(true);
    try {
      const url = await uploadImage.mutateAsync({
        teamId: id,
        localUri: asset.uri,
        contentType: asset.mimeType ?? guessContentType(asset.uri),
      });
      await updateTeam.mutateAsync({ teamId: id, imageUrl: url });
    } catch (err: unknown) {
      showAlert(
        "팀 이미지 변경 실패",
        friendlyError(err),
      );
    } finally {
      setImageBusy(false);
    }
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
        {isLeader ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/team/edit/[id]",
                params: { id: id! },
              })
            }
            hitSlop={8}
            className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
          >
            <Pencil size={16} color="#374151" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <View className="bg-white p-6 rounded-3xl items-center mb-4">
          <Pressable
            onPress={isLeader ? onChangeTeamImage : undefined}
            disabled={!isLeader || imageBusy}
            style={{ width: 80, height: 80, marginBottom: 12 }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                backgroundColor: colors.brand[50],
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {team.imageUrl ? (
                <Image
                  source={{ uri: team.imageUrl }}
                  style={{ width: 80, height: 80 }}
                  resizeMode="cover"
                />
              ) : (
                <Users size={32} color={colors.brand[700]} />
              )}
            </View>
            {isLeader ? (
              <View
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.brand[600],
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {imageBusy ? (
                  <ActivityIndicator size="small" color={colors.brand.fg} />
                ) : (
                  <Camera size={12} color={colors.brand.fg} />
                )}
              </View>
            ) : null}
          </Pressable>
          <Text className="text-2xl font-bold text-gray-900 mb-1">
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
                <ActivityIndicator size="small" color={colors.brand.fg} />
              ) : (
                <UserPlus size={14} color={colors.brand.fg} />
              )}
              <Text className="text-brand-fg font-black text-sm">
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
                        <Text className="text-sm font-black text-brand-700">
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
                    <Text className="text-sm font-black text-brand-700">
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
