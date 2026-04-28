import { View, Text, Image, Pressable } from "react-native";
import { Star, MapPin, ChevronRight } from "lucide-react-native";
import type { Shop } from "@/src/hooks/use-shops";

type Props = {
  shop: Shop;
  onPress?: () => void;
};

export function ShopCard({ shop, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white p-4 rounded-3xl border border-gray-100 flex-row gap-4 items-center active:scale-95"
    >
      <View className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 items-center justify-center">
        {shop.imageUrl ? (
          <Image source={{ uri: shop.imageUrl }} className="w-16 h-16" />
        ) : (
          <Text className="text-2xl">🤿</Text>
        )}
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="font-black text-gray-900 text-sm flex-shrink"
            numberOfLines={1}
          >
            {shop.name}
          </Text>
          {shop.isPremium ? (
            <View className="bg-amber-50 px-1.5 py-0.5 rounded">
              <Text className="text-[8px] font-black text-amber-600">
                PREMIUM
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-center gap-1 mt-0.5">
          <MapPin size={10} color="#6B7280" />
          <Text className="text-[10px] text-gray-500 font-bold">
            {shop.country} · {shop.city} · {shop.region}
          </Text>
        </View>
        <View className="flex-row items-center gap-1 mt-1">
          <Star size={10} color="#F59E0B" fill="#F59E0B" />
          <Text className="text-[10px] font-black text-gray-700">
            {shop.rating.toFixed(1)}
          </Text>
          <Text className="text-[10px] text-gray-400">
            ({shop.reviewCount})
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color="#D1D5DB" />
    </Pressable>
  );
}
