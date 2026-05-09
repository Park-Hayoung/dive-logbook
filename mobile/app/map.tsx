import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useDives } from "@/src/hooks/use-dives";
import { DiveMap, buildDiveMarkers, type DiveMarker } from "@/src/components";

import { colors } from "@/src/lib/colors";
export default function DiveMapScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: dives, isLoading } = useDives(userId);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const markers = useMemo(() => buildDiveMarkers(dives), [dives]);
  const selected = useMemo(
    () => markers.find((m) => m.key === selectedKey) ?? null,
    [markers, selectedKey],
  );

  const summary = useMemo(() => {
    const countries = new Set<string>();
    let geoCount = 0;
    for (const d of dives ?? []) {
      if (d.lat != null && d.lng != null) {
        geoCount += 1;
        if (d.country.trim()) countries.add(d.country.trim());
      }
    }
    return {
      countries: countries.size,
      points: markers.length,
      dives: geoCount,
    };
  }, [dives, markers]);

  const onMarkerPress = (m: DiveMarker) => {
    setSelectedKey(m.key);
  };

  const selectedDives = useMemo(() => {
    if (!selected || !dives) return [];
    const ids = new Set(selected.diveIds);
    return dives.filter((d) => ids.has(d.id));
  }, [selected, dives]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base flex-1">방문한 다이브 포인트</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : markers.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 rounded-full bg-brand-50 items-center justify-center mb-3">
            <MapPin size={28} color={colors.brand[700]} />
          </View>
          <Text className="text-sm font-black text-gray-900 mb-1">
            지도에 표시할 다이브가 없어요
          </Text>
          <Text className="text-[11px] text-gray-400 text-center">
            로그를 작성할 때 위치를 함께 저장하면{"\n"}여기에 핀이 찍혀요.
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          <View className="px-5 py-3 bg-white border-b border-gray-100 flex-row gap-4">
            <SummaryStat label="국가" value={summary.countries} />
            <SummaryStat label="포인트" value={summary.points} />
            <SummaryStat label="다이브" value={summary.dives} />
          </View>

          <View className="flex-1">
            <DiveMap
              dives={dives}
              fill
              interactive
              onMarkerPress={onMarkerPress}
            />
          </View>

          {selected ? (
            <View className="absolute left-4 right-4 bottom-6 bg-white rounded-3xl border border-gray-100 shadow-lg">
              <View className="px-5 pt-4 pb-2 flex-row items-start justify-between gap-3">
                <View className="flex-1 min-w-0">
                  <Text className="text-xs font-black text-brand-700 uppercase">
                    선택한 포인트
                  </Text>
                  <Text
                    className="text-base font-black text-gray-900 mt-1"
                    numberOfLines={1}
                  >
                    {selected.label}
                  </Text>
                  <Text className="text-[11px] text-gray-500 mt-0.5">
                    {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)} ·{" "}
                    {selected.count}회 다이빙
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedKey(null)}
                  hitSlop={8}
                  className="px-2 py-1"
                >
                  <Text className="text-[11px] font-bold text-gray-400">닫기</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal={false}
                style={{ maxHeight: 220 }}
                contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}
              >
                {selectedDives.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() =>
                      router.push({
                        pathname: "/log/[id]",
                        params: { id: d.id },
                      })
                    }
                    className="flex-row items-center px-3 py-2 rounded-2xl active:bg-gray-50"
                  >
                    <View className="flex-1 min-w-0">
                      <Text
                        className="text-sm font-bold text-gray-900"
                        numberOfLines={1}
                      >
                        #{d.diveNumber} · {d.point || d.location}
                      </Text>
                      <Text className="text-[11px] text-gray-500 mt-0.5">
                        {d.startedAt.slice(0, 10)} · 최대 {d.maxDepth.toFixed(1)}m
                      </Text>
                    </View>
                    <ChevronRight size={14} color="#9CA3AF" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <View>
      <Text className="text-[10px] font-black text-gray-400 uppercase">
        {label}
      </Text>
      <Text className="text-base font-black text-gray-900 mt-0.5">{value}</Text>
    </View>
  );
}
