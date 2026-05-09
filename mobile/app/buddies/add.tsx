// 버디 추가 화면.
//   상단: 닉네임 검색 — 부분 일치, 모든 회원 대상.
//   섹션 1: 같은 팀 멤버 (있을 때).
//   섹션 2: 내가 팔로우한 사람들.
//   각 행 옆 "추가" 버튼은 즉시 INSERT 가 아니라 선택만 토글 — 하단 "저장" 으로 일괄 처리.

import { useMemo, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Search,
  User,
  Check,
  Plus,
  Users,
  UserPlus,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useUserBuddies,
  useFollowing,
  useAddBuddy,
  useSearchUsersByNickname,
  type BuddyProfile,
} from "@/src/hooks/use-buddies";
import { useMyTeam, useTeamMembers } from "@/src/hooks/use-teams";
import { showAlert } from "@/src/lib/alert";
import { friendlyError } from "@/src/lib/error-messages";

export default function AddBuddyScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  // 선택만 한 (아직 저장 전) 버디 ID 모음. 하단 "저장" 시 일괄 INSERT.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: existingBuddies } = useUserBuddies(userId);
  const { data: myTeam } = useMyTeam(userId);
  const { data: teamMembers } = useTeamMembers(myTeam?.team?.id);
  const { data: following } = useFollowing(userId);
  const { data: searchResults, isFetching: searching } =
    useSearchUsersByNickname(trimmed, userId);
  const addBuddy = useAddBuddy(userId);

  const buddyIdSet = useMemo(
    () => new Set((existingBuddies ?? []).map((b) => b.id)),
    [existingBuddies],
  );

  // 팀 멤버 → BuddyProfile 형태로 정규화 + 자기/이미 추가된 버디 제외.
  const teamCandidates = useMemo<BuddyProfile[]>(() => {
    if (!teamMembers) return [];
    return teamMembers
      .filter(
        (m) =>
          m.role !== "pending" &&
          m.profile &&
          m.userId !== userId &&
          !buddyIdSet.has(m.userId),
      )
      .map((m) => ({
        id: m.profile!.id,
        nickname: m.profile!.nickname,
        profileImageUrl: m.profile!.profileImageUrl,
        certification: m.profile!.certification,
        divingOrg: null,
      }));
  }, [teamMembers, userId, buddyIdSet]);

  const followingCandidates = useMemo<BuddyProfile[]>(() => {
    if (!following) return [];
    return following.filter((p) => !buddyIdSet.has(p.id));
  }, [following, buddyIdSet]);

  // 검색 모드: 검색어가 있으면 검색 결과만 보여줌.
  const isSearching = trimmed.length > 0;

  const togglePending = (id: string) => {
    if (saving) return;
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSave = async () => {
    if (pendingIds.size === 0 || saving) return;
    setSaving(true);
    const failures: string[] = [];
    // 순차 INSERT — 권한/중복 등 개별 에러를 모아 보여주기 위함. 양 자체는 작아 문제없음.
    for (const id of pendingIds) {
      try {
        await addBuddy.mutateAsync(id);
      } catch (err) {
        failures.push(friendlyError(err));
      }
    }
    setSaving(false);
    if (failures.length > 0) {
      showAlert(
        "일부 추가 실패",
        `${pendingIds.size - failures.length}명 추가됨.\n실패: ${failures.length}건\n${failures.join("\n")}`,
      );
      // 부분 성공이어도 일단 닫지 않고 사용자가 재시도하게 둠.
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          disabled={saving}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base">버디 추가</Text>
      </View>

      <View className="px-5 pt-4 pb-2 bg-gray-50">
        <View className="flex-row items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4">
          <Search size={14} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="닉네임으로 검색"
            placeholderTextColor="#9CA3AF"
            autoCorrect={false}
            autoCapitalize="none"
            editable={!saving}
            className="flex-1 py-3 text-sm text-gray-900"
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {isSearching ? (
          <Section
            title="검색 결과"
            icon={<Search size={14} color={colors.brand[700]} />}
            emptyText={
              searching ? null : "일치하는 닉네임이 없어요."
            }
            loading={searching}
          >
            {(searchResults ?? []).map((p) => (
              <BuddyRow
                key={p.id}
                profile={p}
                added={buddyIdSet.has(p.id)}
                pending={pendingIds.has(p.id)}
                disabled={saving}
                onToggle={() => togglePending(p.id)}
              />
            ))}
          </Section>
        ) : (
          <View className="gap-5">
            <Section
              title={`팀 멤버${myTeam?.team ? ` · ${myTeam.team.name}` : ""}`}
              icon={<Users size={14} color={colors.brand[700]} />}
              emptyText={
                !myTeam?.team
                  ? "아직 가입한 팀이 없어요."
                  : "추가할 팀 멤버가 없어요."
              }
            >
              {teamCandidates.map((p) => (
                <BuddyRow
                  key={p.id}
                  profile={p}
                  added={false}
                  pending={pendingIds.has(p.id)}
                  disabled={saving}
                  onToggle={() => togglePending(p.id)}
                />
              ))}
            </Section>

            <Section
              title="팔로잉"
              icon={<UserPlus size={14} color={colors.brand[700]} />}
              emptyText="추가할 팔로잉이 없어요."
            >
              {followingCandidates.map((p) => (
                <BuddyRow
                  key={p.id}
                  profile={p}
                  added={false}
                  pending={pendingIds.has(p.id)}
                  disabled={saving}
                  onToggle={() => togglePending(p.id)}
                />
              ))}
            </Section>
          </View>
        )}
      </ScrollView>

      {/* 하단 sticky 저장 바 */}
      <View className="absolute left-0 right-0 bottom-0 px-5 pb-6 pt-3 bg-white border-t border-gray-100">
        <Pressable
          onPress={onSave}
          disabled={pendingIds.size === 0 || saving}
          className={`p-4 rounded-2xl items-center flex-row justify-center gap-2 ${
            pendingIds.size === 0 ? "bg-gray-200" : "bg-brand-600"
          }`}
        >
          {saving ? (
            <ActivityIndicator color={colors.brand.fg} />
          ) : (
            <Text
              className={`font-black text-sm ${
                pendingIds.size === 0 ? "text-gray-500" : "text-brand-fg"
              }`}
            >
              {pendingIds.size === 0
                ? "추가할 버디를 선택해주세요"
                : `${pendingIds.size}명 추가하기`}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Section({
  title,
  icon,
  children,
  emptyText,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  emptyText: string | null;
  loading?: boolean;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const hasItems = arr.filter(Boolean).length > 0;
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-1.5 px-1">
        {icon}
        <Text className="text-[11px] font-black text-gray-500 uppercase">
          {title}
        </Text>
      </View>
      {loading ? (
        <View className="bg-white p-6 rounded-2xl items-center">
          <ActivityIndicator />
        </View>
      ) : hasItems ? (
        <View className="gap-2">{children}</View>
      ) : emptyText ? (
        <View className="bg-white p-5 rounded-2xl">
          <Text className="text-[11px] text-gray-400 text-center">
            {emptyText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function BuddyRow({
  profile,
  added,
  pending,
  disabled,
  onToggle,
}: {
  profile: BuddyProfile;
  added: boolean;
  pending: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  // 행 자체를 눌러도 선택 토글되도록 (큰 터치 영역).
  const interactive = !added && !disabled;
  return (
    <Pressable
      onPress={interactive ? onToggle : undefined}
      disabled={!interactive}
      className={`p-3 rounded-2xl border flex-row items-center gap-3 ${
        pending
          ? "bg-brand-50 border-brand-200"
          : "bg-white border-gray-100"
      }`}
    >
      <Avatar uri={profile.profileImageUrl} size={40} />
      <View className="flex-1 min-w-0">
        <Text
          className="text-sm font-black text-gray-900"
          numberOfLines={1}
        >
          {profile.nickname}
        </Text>
        {profile.divingOrg || profile.certification ? (
          <Text className="text-[11px] text-gray-500 mt-0.5" numberOfLines={1}>
            {[profile.divingOrg, profile.certification]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}
      </View>
      {added ? (
        <View className="flex-row items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-full">
          <Check size={12} color="#059669" />
          <Text className="text-[10px] font-black text-emerald-700">
            추가됨
          </Text>
        </View>
      ) : pending ? (
        <View className="flex-row items-center gap-1 bg-brand-600 px-3 py-1.5 rounded-full">
          <Check size={12} color={colors.brand.fg} />
          <Text className="text-[10px] font-black text-brand-fg">선택됨</Text>
        </View>
      ) : (
        <View className="flex-row items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-full">
          <Plus size={12} color={colors.brand[700]} />
          <Text className="text-[10px] font-black text-brand-700">선택</Text>
        </View>
      )}
    </Pressable>
  );
}

function Avatar({ uri, size }: { uri: string | null; size: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="bg-brand-50"
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-brand-50 items-center justify-center"
    >
      <User size={size * 0.5} color={colors.brand[700]} />
    </View>
  );
}
