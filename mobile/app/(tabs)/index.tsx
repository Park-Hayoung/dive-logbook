import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors } from "@/src/lib/colors";
import {
  Map as MapIcon,
  MapPin,
  Navigation,
  ChevronRight,
  Plus,
  CalendarDays,
  Trash2,
  Bell,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  Clock,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useProfile } from "@/src/hooks/use-profile";
import { useDives } from "@/src/hooks/use-dives";
import {
  useUpcomingSchedules,
  useDeleteDiveSchedule,
} from "@/src/hooks/use-dive-schedules";
import { useRecentNotificationCount } from "@/src/hooks/use-notifications";
import { showAlert } from "@/src/lib/alert";
import { DiveMap, LogCard, buildDiveMarkers } from "@/src/components";

const RECENT_LIMIT = 2;

const formatDateRange = (start: string, end: string): string => {
  if (start === end) return formatYmd(start);
  const a = formatYmd(start);
  const b = formatYmd(end);
  return `${a} – ${b}`;
};

const formatYmd = (ymd: string): string => {
  const [, mm, dd] = ymd.split("-");
  return `${Number(mm)}.${Number(dd)}`;
};

const daysUntil = (ymd: string): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(ymd + "T00:00:00");
  return Math.round((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
};

const extractErrorMessage = (e: unknown): string => {
  if (!e) return "";
  if (e instanceof Error) return e.message || "(빈 메시지)";
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.code === "string" || typeof obj.details === "string") {
      return [obj.code, obj.details, obj.hint].filter(Boolean).join(" · ");
    }
    try {
      return JSON.stringify(e);
    } catch {
      return "직렬화 불가";
    }
  }
  return String(e);
};

type StatCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  width: number;
  highlighted?: boolean;
  subtitle?: string;
};

function StatCard({
  label,
  value,
  unit,
  icon,
  width,
  highlighted,
  subtitle,
}: StatCardProps) {
  return (
    <View
      style={{ width }}
      className={`p-5 rounded-3xl border ${
        highlighted
          ? "bg-brand-600 border-brand-600"
          : "bg-white border-gray-100"
      }`}
    >
      <View className="flex-row items-center gap-2 mb-3">
        <View
          className={`w-8 h-8 rounded-full items-center justify-center ${
            highlighted ? "bg-white/15" : "bg-brand-50"
          }`}
        >
          {icon}
        </View>
        <Text
          className={`text-base font-black ${
            highlighted ? "text-brand-fg" : "text-gray-700"
          }`}
        >
          {label}
        </Text>
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text
          className={`text-4xl font-black leading-none ${
            highlighted ? "text-brand-fg" : "text-gray-900"
          }`}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            className={`text-base font-bold ${
              highlighted ? "text-brand-fg/80" : "text-gray-500"
            }`}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      {subtitle ? (
        <Text
          className={`text-[11px] font-bold mt-2 ${
            highlighted ? "text-brand-fg/80" : "text-gray-400"
          }`}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.round(screenWidth * 0.7);
  const cardGap = 12;
  const userId = useAuthStore((s) => s.user?.id);
  const { data: profile } = useProfile(userId);
  const { data: dives, isLoading } = useDives(userId);
  const {
    data: schedules = [],
    error: schedulesError,
  } = useUpcomingSchedules(userId, 3);
  const deleteSchedule = useDeleteDiveSchedule(userId);
  const { count: notifCount } = useRecentNotificationCount(userId);

  const stats = (() => {
    if (!dives || dives.length === 0) {
      return { count: 0, verifiedCount: 0, maxDepth: 0, totalMinutes: 0 };
    }
    let verifiedCount = 0;
    let maxDepth = 0;
    let totalMinutes = 0;
    for (const d of dives) {
      if (d.isVerified) verifiedCount += 1;
      if (d.maxDepth > maxDepth) maxDepth = d.maxDepth;
      totalMinutes += d.durationMinutes;
    }
    return {
      count: dives.length,
      verifiedCount,
      maxDepth,
      totalMinutes,
    };
  })();

  const recentDives = dives?.slice(0, RECENT_LIMIT) ?? [];
  const mapMarkerCount = useMemo(
    () => buildDiveMarkers(dives).length,
    [dives],
  );
  const totalDives = (profile?.total_dives_at_signup ?? 0) + stats.count;
  const totalHours = Math.floor(stats.totalMinutes / 60);
  const remainderMinutes = stats.totalMinutes % 60;

  const onDeleteSchedule = (id: string, title: string) => {
    showAlert("일정 삭제", `"${title}"을(를) 삭제하시겠어요?`, [
      { text: "취소" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => deleteSchedule.mutate(id),
      },
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <View className="flex-row justify-between items-start mb-6">
          <View className="flex-1">
            <Text style={{ fontFamily: "KCCDodamdodam" }} className="text-2xl font-title text-gray-900 mb-1">
              안녕하세요, {profile?.nickname ?? "다이버"}님 🌊
            </Text>
            <Text className="text-sm text-gray-500">
              오늘도 당신의 바다를 기록해보세요.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/notifications" as never)}
            hitSlop={8}
            className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-200 relative"
          >
            <Bell size={16} color="#374151" />
            {notifCount > 0 ? (
              <View className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center">
                <Text className="text-[9px] font-black text-white">
                  {notifCount > 99 ? "99+" : notifCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center mb-6">
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={cardWidth + cardGap}
              snapToAlignment="start"
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{
                paddingHorizontal: 20,
                gap: cardGap,
              }}
              className="mb-6"
            >
              <StatCard
                label="총 다이브"
                value={totalDives}
                unit="회"
                width={cardWidth}
                highlighted
                icon={<BarChart3 size={14} color={colors.brand.fg} />}
                subtitle={
                  profile?.total_dives_at_signup
                    ? `이전 기록 ${profile.total_dives_at_signup}회 포함`
                    : undefined
                }
              />
              <StatCard
                label="인증"
                value={stats.verifiedCount}
                unit="회"
                width={cardWidth}
                icon={<ShieldCheck size={14} color={colors.brand[700]} />}
              />
              <StatCard
                label="미인증"
                value={Math.max(0, totalDives - stats.verifiedCount)}
                unit="회"
                width={cardWidth}
                icon={<ShieldAlert size={14} color="#9CA3AF" />}
                subtitle={
                  profile?.total_dives_at_signup
                    ? `이전 기록 ${profile.total_dives_at_signup}회 포함`
                    : undefined
                }
              />
              <StatCard
                label="최대 수심"
                value={stats.maxDepth ? stats.maxDepth.toFixed(1) : "—"}
                unit={stats.maxDepth ? "m" : ""}
                width={cardWidth}
                icon={<Navigation size={14} color={colors.brand[700]} />}
              />
              <StatCard
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
                width={cardWidth}
                icon={<Clock size={14} color={colors.brand[700]} />}
              />
            </ScrollView>

            {mapMarkerCount > 0 ? (
              <View className="bg-white rounded-3xl mb-6 overflow-hidden border border-gray-100">
                <Pressable
                  onPress={() => router.push("/map" as never)}
                  className="px-5 pt-5 pb-3 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-1.5">
                    <MapPin size={14} color="#6B7280" />
                    <Text className="text-sm font-black text-gray-500">
                      방문한 다이브 포인트
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs font-bold text-gray-500">
                      {mapMarkerCount}곳
                    </Text>
                    <ChevronRight size={14} color="#9CA3AF" />
                  </View>
                </Pressable>
                <View className="px-3 pb-3">
                  <DiveMap
                    dives={dives}
                    height={180}
                    interactive={false}
                    onPress={() => router.push("/map" as never)}
                  />
                </View>
              </View>
            ) : null}
          </>
        )}

        <Pressable
          onPress={() => router.push("/shop/search")}
          className="bg-gray-900 p-6 rounded-[2.5rem] flex-row items-center justify-between mb-6"
        >
          <View className="flex-row items-center gap-4">
            <View className="w-14 h-14 bg-brand-600 rounded-3xl items-center justify-center">
              <MapIcon size={28} color={colors.brand.fg} />
            </View>
            <View>
              <Text className="text-white font-black text-lg">
                지도에서 샵 찾기
              </Text>
              <Text className="text-brand-400 text-xs font-bold uppercase">
                Find Dive Centers
              </Text>
            </View>
          </View>
          <ChevronRight size={22} color="#6B7280" />
        </Pressable>

        <View className="flex-row justify-between items-center mb-3 px-1">
          <Text className="text-sm font-black text-gray-500">
            다가오는 일정
          </Text>
          <Pressable
            onPress={() => router.push("/schedule/new")}
            className="flex-row items-center gap-1"
            hitSlop={8}
          >
            <Plus size={14} color={colors.brand[700]} />
            <Text className="text-xs font-bold text-brand-700">추가</Text>
          </Pressable>
        </View>

        {schedulesError ? (
          <View className="bg-red-50 border border-red-100 p-4 rounded-2xl mb-6">
            <Text className="text-xs font-bold text-red-700">
              일정을 불러오지 못했어요
            </Text>
            <Text className="text-xs text-red-600 mt-1">
              {extractErrorMessage(schedulesError)}
            </Text>
          </View>
        ) : null}

        {schedules.length === 0 ? (
          <Pressable
            onPress={() => router.push("/schedule/new")}
            className="bg-white p-6 rounded-3xl items-center border border-dashed border-gray-200 mb-6"
          >
            <View className="w-12 h-12 rounded-full bg-brand-50 items-center justify-center mb-2">
              <CalendarDays size={20} color={colors.brand[700]} />
            </View>
            <Text className="text-base font-black text-gray-900">
              다이빙 일정을 추가해보세요
            </Text>
            <Text className="text-xs text-gray-400 mt-1">
              여행, 펀다이빙, 워크숍 등
            </Text>
          </Pressable>
        ) : (
          <View className="gap-2 mb-6">
            {schedules.map((s) => {
              const days = daysUntil(s.startDate);
              const dayLabel =
                days <= 0 ? "진행 중" : days === 1 ? "내일" : `D-${days}`;
              return (
                <View
                  key={s.id}
                  className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-3"
                >
                  <View className="w-12 h-12 rounded-2xl bg-brand-50 items-center justify-center">
                    <Text className="text-xs font-black text-brand-700">
                      {dayLabel}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text
                      className="font-black text-base text-gray-900"
                      numberOfLines={1}
                    >
                      {s.title}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      {formatDateRange(s.startDate, s.endDate)}
                      {s.point ? ` · ${s.point}` : ""}
                      {s.shopName ? ` · ${s.shopName}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onDeleteSchedule(s.id, s.title)}
                    hitSlop={8}
                    className="p-2"
                  >
                    <Trash2 size={14} color="#9CA3AF" />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View className="flex-row justify-between items-center mb-3 px-1">
          <Text className="text-sm font-black text-gray-500">
            최근 기록
          </Text>
          {recentDives.length > 0 ? (
            <Pressable onPress={() => router.push("/(tabs)/logbook")}>
              <Text className="text-xs font-bold text-brand-700">
                전체 보기
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : recentDives.length === 0 ? (
          <Pressable
            onPress={() => router.push("/log/new")}
            className="bg-white p-6 rounded-3xl items-center border border-dashed border-gray-200"
          >
            <View className="w-12 h-12 rounded-full bg-brand-50 items-center justify-center mb-2">
              <Plus size={20} color={colors.brand[700]} />
            </View>
            <Text className="text-base font-black text-gray-900">
              첫 다이브를 기록해보세요
            </Text>
            <Text className="text-xs text-gray-400 mt-1">
              +버튼을 눌러 바로 시작
            </Text>
          </Pressable>
        ) : (
          <View className="gap-3">
            {recentDives.map((dive) => (
              <LogCard key={dive.id} dive={dive} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
