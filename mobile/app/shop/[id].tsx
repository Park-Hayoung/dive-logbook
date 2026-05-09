import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Star, MapPin, Sparkles } from "lucide-react-native";

import { useShop } from "@/src/hooks/use-shops";

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: shop, isLoading } = useShop(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-gray-400 mb-4">샵을 찾을 수 없어요.</Text>
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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="bg-white">
          <View className="px-5 py-3 flex-row items-center">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
            >
              <ChevronLeft size={22} color="#374151" />
            </Pressable>
          </View>

          {shop.imageUrl ? (
            <Image
              source={{ uri: shop.imageUrl }}
              className="w-full h-56"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-56 bg-brand-50 items-center justify-center">
              <Text className="text-7xl">🤿</Text>
            </View>
          )}

          <View className="px-5 pt-4 pb-6 rounded-b-[2.5rem] border-b border-gray-100">
            {shop.isPremium ? (
              <View className="flex-row items-center gap-1 self-start bg-amber-50 px-2 py-1 rounded-lg mb-2">
                <Sparkles size={10} color="#D97706" />
                <Text className="text-[10px] font-black text-amber-700">
                  PREMIUM
                </Text>
              </View>
            ) : null}
            <Text style={{ fontFamily: "KCCDodamdodam" }} className="text-2xl font-title text-gray-900">
              {shop.name}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-2">
              <MapPin size={12} color="#6B7280" />
              <Text className="text-xs text-gray-600 font-bold">
                {shop.country} · {shop.city} · {shop.region}
              </Text>
            </View>
            <View className="flex-row items-center gap-2 mt-3">
              <View className="flex-row items-center gap-1">
                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                <Text className="text-base font-black text-gray-900">
                  {shop.rating.toFixed(1)}
                </Text>
              </View>
              <Text className="text-xs text-gray-400">
                후기 {shop.reviewCount}개
              </Text>
            </View>
          </View>
        </View>

        <View className="px-5 pt-5">
          {shop.description ? (
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-3">
              <Text className="text-[10px] font-black text-gray-400 uppercase mb-2">
                소개
              </Text>
              <Text className="text-sm text-gray-700 leading-5">
                {shop.description}
              </Text>
            </View>
          ) : null}

          <View className="bg-white p-5 rounded-3xl border border-gray-100">
            <Text className="text-[10px] font-black text-gray-400 uppercase mb-2">
              예약
            </Text>
            <Text className="text-xs text-gray-400 mb-4">
              다중일 캘린더 예약 · 다이브 종류 선택 · 메시지는 후속 추가
            </Text>
            <Pressable
              disabled
              className="bg-gray-100 p-4 rounded-2xl items-center"
            >
              <Text className="text-gray-400 font-black text-sm">
                예약 문의 (준비 중)
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
