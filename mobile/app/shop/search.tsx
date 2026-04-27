import { View, Text, ScrollView, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function ShopSearchScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-4 flex-row justify-between items-center border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={24} color="#374151" />
        </Pressable>
        <Text className="font-black text-base uppercase">Shop Explorer</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-5">
        <Text className="text-center text-gray-400 text-xs mt-8">
          TODO: 3단계 의존성 필터(국가→도시→지역), Google Maps, 샵 리스트
        </Text>
      </ScrollView>
    </View>
  );
}
