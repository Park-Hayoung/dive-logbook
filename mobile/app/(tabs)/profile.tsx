import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Award,
  Navigation,
  Clock,
  BarChart3,
  Users,
  ChevronRight,
  Camera,
  ShieldCheck,
  Globe,
  Anchor,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useProfile } from "@/src/hooks/use-profile";
import { useDives } from "@/src/hooks/use-dives";
import { useFollowCounts } from "@/src/hooks/use-follows";
import { useMyTeam } from "@/src/hooks/use-teams";
import { StatBox, Avatar } from "@/src/components";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const userId = user?.id;

  const { data: profile, isLoading: isProfileLoading } = useProfile(userId);
  const { data: dives, isLoading: isDivesLoading } = useDives(userId);
  const { data: followCounts } = useFollowCounts(userId);
  const { data: myTeam } = useMyTeam(userId);

  const stats = (() => {
    if (!dives || dives.length === 0) {
      return {
        count: 0,
        verifiedCount: 0,
        maxDepth: 0,
        totalMinutes: 0,
        countries: [] as Array<{ country: string; count: number }>,
      };
    }
    const countryCounts = new Map<string, number>();
    let verifiedCount = 0;
    let maxDepth = 0;
    let totalMinutes = 0;
    for (const d of dives) {
      const c = d.country.trim();
      if (c) countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
      if (d.isVerified) verifiedCount += 1;
      if (d.maxDepth > maxDepth) maxDepth = d.maxDepth;
      totalMinutes += d.durationMinutes;
    }
    const countries = [...countryCounts.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return {
      count: dives.length,
      verifiedCount,
      maxDepth,
      totalMinutes,
      countries,
    };
  })();

  const totalDives =
    (profile?.total_dives_at_signup ?? 0) + stats.count;
  const totalHours = Math.floor(stats.totalMinutes / 60);
  const remainderMinutes = stats.totalMinutes % 60;

  const isLoading = isProfileLoading || isDivesLoading;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View className="bg-white p-6 rounded-3xl items-center mb-4">
        <Pressable
          onPress={() => router.push("/profile/edit" as never)}
          style={{ width: 80, height: 80, marginBottom: 12 }}
        >
          <Avatar
            uri={profile?.profile_image_url}
            name={profile?.nickname ?? "Diver"}
            size={80}
          />
          <View
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "#2563EB",
              borderWidth: 2,
              borderColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Camera size={12} color="#fff" />
          </View>
        </Pressable>
        <Text className="text-2xl font-black text-gray-900 mb-1">
          {profile?.nickname ?? "Diver"}
        </Text>
        <Text className="text-xs text-gray-500 mb-3">{user?.email}</Text>
        <View className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full mb-3">
          <Award size={12} color="#2563EB" />
          <Text className="text-[10px] font-black text-brand-700">
            {profile?.diving_org ?? "—"} · {profile?.certification ?? "—"}
          </Text>
        </View>
        <View className="flex-row gap-6">
          <View className="items-center">
            <Text className="text-base font-black text-gray-900">
              {followCounts?.followers ?? 0}
            </Text>
            <Text className="text-[10px] text-gray-400 font-bold uppercase">
              팔로워
            </Text>
          </View>
          <View className="items-center">
            <Text className="text-base font-black text-gray-900">
              {followCounts?.following ?? 0}
            </Text>
            <Text className="text-[10px] text-gray-400 font-bold uppercase">
              팔로잉
            </Text>
          </View>
        </View>

      </View>

      <Text className="text-[10px] font-black text-gray-400 uppercase mb-2 px-1">
        활동 요약
      </Text>

      {isLoading ? (
        <View className="bg-white p-8 rounded-3xl items-center mb-4">
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <View className="flex-row gap-2 mb-2">
            <View className="flex-1">
              <StatBox
                label="총 다이브"
                value={totalDives}
                unit="회"
                highlighted
                icon={<BarChart3 size={10} color="#DBEAFE" />}
              />
            </View>
            <View className="flex-1">
              <StatBox
                label="인증"
                value={stats.verifiedCount}
                unit="회"
                icon={<ShieldCheck size={10} color="#9CA3AF" />}
              />
            </View>
          </View>

          <View className="flex-row gap-2 mb-4">
            <View className="flex-1">
              <StatBox
                label="최대 수심"
                value={stats.maxDepth ? stats.maxDepth.toFixed(1) : "—"}
                unit={stats.maxDepth ? "m" : ""}
                icon={<Navigation size={10} color="#9CA3AF" />}
              />
            </View>
            <View className="flex-1">
              <StatBox
                label="총 시간"
                value={
                  stats.totalMinutes
                    ? totalHours > 0
                      ? `${totalHours}:${String(remainderMinutes).padStart(2, "0")}`
                      : `${remainderMinutes}`
                    : "—"
                }
                unit={
                  stats.totalMinutes
                    ? totalHours > 0
                      ? "h"
                      : "분"
                    : ""
                }
                icon={<Clock size={10} color="#9CA3AF" />}
              />
            </View>
          </View>

          {stats.countries.length > 0 ? (
            <View className="bg-white p-5 rounded-3xl mb-4">
              <View className="flex-row items-center gap-1.5 mb-3">
                <Globe size={12} color="#6B7280" />
                <Text className="text-[10px] font-black text-gray-400 uppercase">
                  주 방문 국가
                </Text>
              </View>
              <View className="gap-3">
                {stats.countries.map((c) => {
                  const pct = Math.round((c.count / stats.count) * 100);
                  return (
                    <View key={c.country} className="gap-1">
                      <View className="flex-row justify-between">
                        <Text className="text-sm font-bold text-gray-700">
                          {c.country}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          {c.count}회 · {pct}%
                        </Text>
                      </View>
                      <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </>
      )}

      {profile?.bio ? (
        <View className="bg-white p-5 rounded-3xl mb-4">
          <Text className="text-[10px] font-black text-gray-400 uppercase mb-2">
            소개
          </Text>
          <Text className="text-sm text-gray-700 leading-5">{profile.bio}</Text>
        </View>
      ) : null}

      {myTeam?.team ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/team/[id]",
              params: { id: myTeam.team!.id },
            })
          }
          className="bg-white p-4 rounded-2xl flex-row items-center gap-3 mb-3"
        >
          <View className="w-10 h-10 rounded-2xl bg-brand-50 items-center justify-center">
            <Users size={18} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="text-[10px] font-black text-gray-400 uppercase">
              내 팀 · {myTeam.role === "leader" ? "리더" : "멤버"}
            </Text>
            <Text className="font-black text-sm text-gray-900">
              {myTeam.team.name}
            </Text>
          </View>
          <ChevronRight size={16} color="#D1D5DB" />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push("/team" as never)}
          className="bg-white p-4 rounded-2xl flex-row items-center gap-3 mb-3"
        >
          <View className="w-10 h-10 rounded-2xl bg-gray-100 items-center justify-center">
            <Users size={18} color="#6B7280" />
          </View>
          <View className="flex-1">
            <Text className="font-black text-sm text-gray-900">
              팀 둘러보기
            </Text>
            <Text className="text-[10px] text-gray-500">
              다이빙 팀에 가입하거나 직접 만들어보세요
            </Text>
          </View>
          <ChevronRight size={16} color="#D1D5DB" />
        </Pressable>
      )}

      <Pressable
        onPress={() => router.push("/equipment" as never)}
        className="bg-white p-4 rounded-2xl flex-row items-center gap-3 mb-3"
      >
        <View className="w-10 h-10 rounded-2xl bg-brand-50 items-center justify-center">
          <Anchor size={18} color="#2563EB" />
        </View>
        <View className="flex-1">
          <Text className="font-black text-sm text-gray-900">장비 관리</Text>
          <Text className="text-[10px] text-gray-500">
            보유 다이빙 장비를 등록하고 관리해요
          </Text>
        </View>
        <ChevronRight size={16} color="#D1D5DB" />
      </Pressable>

      <Pressable
        onPress={signOut}
        className="bg-gray-900 p-4 rounded-2xl items-center"
      >
        <Text className="text-white font-black">로그아웃</Text>
      </Pressable>

      <Text className="text-center text-gray-400 text-[10px] mt-4">
        QR 네트워킹은 추후 추가
      </Text>
    </ScrollView>
    </SafeAreaView>
  );
}
