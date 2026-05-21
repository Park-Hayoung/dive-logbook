import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Bluetooth,
  ShieldCheck,
  ShieldAlert,
  Waves,
  ArrowDownWideNarrow,
  Pencil,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useDives } from "@/src/hooks/use-dives";
import { LogCard } from "@/src/components";

import { colors } from "@/src/lib/colors";

type Filter = "all" | "verified" | "unverified";
type SortKey = "date-desc" | "date-asc" | "created-desc" | "depth-desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date-desc", label: "최신 다이브순" },
  { key: "date-asc", label: "오래된 다이브순" },
  { key: "created-desc", label: "최근 등록순" },
  { key: "depth-desc", label: "최대수심순" },
];

export default function LogbookScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: dives, isLoading } = useDives(userId);
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("date-desc");

  const stats = useMemo(() => {
    if (!dives) return { total: 0, verified: 0, unverified: 0 };
    let verified = 0;
    for (const d of dives) if (d.isVerified) verified += 1;
    return { total: dives.length, verified, unverified: dives.length - verified };
  }, [dives]);

  // 통산 다이브 번호 — 입수일(started_at) 오름차순으로 1부터 매김. 정렬 옵션과 무관하게 고정.
  // DB의 dive_number 는 BLE 임포트 시 fingerprint(거대 timestamp)가 들어가 사용 불가.
  const ordinalByDiveId = useMemo(() => {
    const map = new Map<string, number>();
    if (!dives) return map;
    const sorted = [...dives].sort((a, b) =>
      a.startedAt.localeCompare(b.startedAt),
    );
    sorted.forEach((d, i) => map.set(d.id, i + 1));
    return map;
  }, [dives]);

  const visibleDives = useMemo(() => {
    if (!dives) return [];
    const filtered =
      filter === "verified"
        ? dives.filter((d) => d.isVerified)
        : filter === "unverified"
          ? dives.filter((d) => !d.isVerified)
          : dives;
    const sorted = [...filtered];
    switch (sort) {
      case "date-asc":
        sorted.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
        break;
      case "created-desc":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "depth-desc":
        sorted.sort((a, b) => b.maxDepth - a.maxDepth);
        break;
      case "date-desc":
      default:
        sorted.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        break;
    }
    return sorted;
  }, [dives, filter, sort]);

  const toggleFilter = (next: Filter) =>
    setFilter((prev) => (prev === next ? "all" : next));

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-bold text-gray-900">내 로그북</Text>
          <Pressable
            onPress={() => router.push("/log/import")}
            accessibilityLabel="다이브 컴퓨터에서 가져오기"
            className="flex-row items-center gap-1.5 bg-brand-600 px-3 py-2 rounded-xl active:scale-95"
          >
            <Bluetooth size={14} color={colors.brand.fg} />
            <Text className="text-xs font-black text-brand-fg">가져오기</Text>
          </Pressable>
        </View>

        <View className="bg-gray-900 p-5 rounded-3xl mb-6">
          <View className="flex-row items-center gap-1.5 mb-4">
            <Waves size={14} color="#9CA3AF" />
            <Text className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
              다이빙 현황
            </Text>
          </View>

          <Pressable onPress={() => setFilter("all")} className="mb-4">
            <View className="flex-row items-baseline">
              <Text className="text-5xl font-black text-white leading-none">
                {stats.total}
              </Text>
              <Text className="text-base font-bold text-gray-400 ml-2">
                회 총 다이브
              </Text>
            </View>
            {filter !== "all" ? (
              <Text className="text-[10px] font-bold text-brand-400 mt-1.5">
                탭하면 전체 보기로 돌아가요
              </Text>
            ) : null}
          </Pressable>

          <View className="flex-row gap-2">
            <DashChip
              label="인증"
              value={stats.verified}
              icon={
                <ShieldCheck
                  size={12}
                  color={
                    filter === "verified" ? colors.brand.fg : colors.brand[400]
                  }
                />
              }
              active={filter === "verified"}
              onPress={() => toggleFilter("verified")}
            />
            <DashChip
              label="미인증"
              value={stats.unverified}
              icon={
                <ShieldAlert
                  size={12}
                  color={filter === "unverified" ? colors.brand.fg : "#9CA3AF"}
                />
              }
              active={filter === "unverified"}
              onPress={() => toggleFilter("unverified")}
            />
          </View>
        </View>

        {!isLoading && dives && dives.length > 0 && (
          <View className="mb-4">
            <View className="flex-row items-center gap-1.5 mb-2 px-1">
              <ArrowDownWideNarrow size={11} color="#6B7280" />
              <Text className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                정렬
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
            >
              {SORT_OPTIONS.map((opt) => {
                const active = sort === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setSort(opt.key)}
                    className={`px-3 py-1.5 rounded-full border ${
                      active
                        ? "bg-gray-900 border-gray-900"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-black ${
                        active ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {isLoading && <ActivityIndicator size="large" />}

        {!isLoading && (!dives || dives.length === 0) && (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs">
              아직 기록된 다이브가 없어요. 우측 아래 연필 버튼으로 첫 로그를 기록해보세요.
            </Text>
          </View>
        )}

        {!isLoading && dives && dives.length > 0 && visibleDives.length === 0 && (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs">
              {filter === "verified" ? "인증된" : "미인증"} 다이브가 없어요.
            </Text>
          </View>
        )}

        <View className="gap-4">
          {visibleDives.map((dive) => (
            <LogCard
              key={dive.id}
              dive={dive}
              displayNumber={ordinalByDiveId.get(dive.id)}
            />
          ))}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push("/log/new")}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-brand-600 items-center justify-center shadow-lg active:scale-95"
        accessibilityLabel="새 로그 기록"
      >
        <Pencil size={22} color={colors.brand.fg} />
      </Pressable>
    </SafeAreaView>
  );
}

type DashChipProps = {
  label: string;
  value: number;
  icon: ReactNode;
  active: boolean;
  onPress: () => void;
};

function DashChip({ label, value, icon, active, onPress }: DashChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-between px-3 py-2.5 rounded-2xl border ${
        active
          ? "bg-brand-500 border-brand-500"
          : "bg-white/5 border-white/10"
      }`}
    >
      <View className="flex-row items-center gap-1.5">
        <View
          className={`w-6 h-6 rounded-full items-center justify-center ${
            active ? "bg-white/20" : "bg-white/10"
          }`}
        >
          {icon}
        </View>
        <Text
          className={`text-xs font-black ${
            active ? "text-brand-fg" : "text-gray-300"
          }`}
        >
          {label}
        </Text>
      </View>
      <Text
        className={`text-lg font-black ${
          active ? "text-brand-fg" : "text-white"
        }`}
      >
        {value}
      </Text>
    </Pressable>
  );
}
