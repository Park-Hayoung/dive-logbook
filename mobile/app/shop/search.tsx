import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Filter as FilterIcon } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useShops, useShopLocations } from "@/src/hooks/use-shops";
import { ShopCard } from "@/src/components";

export default function ShopSearchScreen() {
  const router = useRouter();
  const { data: locations } = useShopLocations();
  const [country, setCountry] = useState<string | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const [region, setRegion] = useState<string | undefined>();
  const { data: shops, isLoading } = useShops({ country, city, region });

  const cities = useMemo(() => {
    if (!country || !locations) return [];
    return locations.citiesByCountry[country] ?? [];
  }, [country, locations]);

  const regions = useMemo(() => {
    if (!country || !city || !locations) return [];
    return locations.regionsByCity[`${country}/${city}`] ?? [];
  }, [country, city, locations]);

  const onPickCountry = (next: string) => {
    setCountry(next === country ? undefined : next);
    setCity(undefined);
    setRegion(undefined);
  };
  const onPickCity = (next: string) => {
    setCity(next === city ? undefined : next);
    setRegion(undefined);
  };
  const onPickRegion = (next: string) => {
    setRegion(next === region ? undefined : next);
  };
  const reset = () => {
    setCountry(undefined);
    setCity(undefined);
    setRegion(undefined);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row justify-between items-center border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base">Shop Explorer</Text>
        <Pressable onPress={reset} hitSlop={8}>
          <Text className="text-[10px] font-bold text-gray-500">초기화</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <View className="flex-row items-center gap-1.5 mb-3">
          <FilterIcon size={12} color="#6B7280" />
          <Text className="text-[10px] font-black text-gray-400 uppercase">
            지역 필터
          </Text>
        </View>

        <FilterRow
          label="국가"
          options={locations?.countries ?? []}
          value={country}
          onPick={onPickCountry}
        />
        <FilterRow
          label="도시"
          options={cities}
          value={city}
          onPick={onPickCity}
          disabled={!country}
        />
        <FilterRow
          label="지역"
          options={regions}
          value={region}
          onPick={onPickRegion}
          disabled={!city}
        />

        <View className="flex-row justify-between items-center mt-6 mb-3 px-1">
          <Text className="text-[10px] font-black text-gray-400 uppercase">
            검색 결과 {shops ? shops.length : 0}
          </Text>
        </View>

        {isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : !shops || shops.length === 0 ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs text-center">
              조건에 맞는 다이브 샵이 없어요.
              {"\n"}필터를 바꿔보거나 초기화해보세요.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {shops.map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                onPress={() =>
                  router.push({
                    pathname: "/shop/[id]",
                    params: { id: shop.id },
                  })
                }
              />
            ))}
          </View>
        )}

        <Text className="text-center text-[10px] text-gray-300 mt-8">
          지도 보기는 추후 추가
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type FilterRowProps = {
  label: string;
  options: string[];
  value: string | undefined;
  onPick: (v: string) => void;
  disabled?: boolean;
};

function FilterRow({ label, options, value, onPick, disabled }: FilterRowProps) {
  return (
    <View className="mb-3">
      <Text className="text-[10px] font-bold text-gray-700 mb-1.5 px-1">
        {label}
      </Text>
      {options.length === 0 ? (
        <Text className="text-[10px] text-gray-400 px-1">
          {disabled ? "상위 항목을 먼저 선택" : "데이터 없음"}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {options.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => onPick(opt)}
                className={`px-3 py-2 rounded-xl border ${
                  value === opt
                    ? "bg-brand-600 border-brand-600"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    value === opt ? "text-white" : "text-gray-700"
                  }`}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
