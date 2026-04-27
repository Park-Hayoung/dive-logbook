import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Map as MapIcon, Navigation } from "lucide-react-native";

export default function HomeScreen() {
  const router = useRouter();
  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      <Text className="text-2xl font-black text-gray-900 mb-1">
        안녕하세요, 다이버님! 🌊
      </Text>
      <Text className="text-sm text-gray-500 mb-8">
        기록하고 싶은 바다를 다이브로그와 함께하세요.
      </Text>

      <Pressable
        onPress={() => router.push("/shop/search")}
        className="bg-gray-900 p-6 rounded-[2.5rem] flex-row items-center justify-between mb-8"
      >
        <View className="flex-row items-center gap-4">
          <View className="w-14 h-14 bg-brand-600 rounded-3xl items-center justify-center">
            <MapIcon size={28} color="white" />
          </View>
          <View>
            <Text className="text-white font-black text-base">
              지도에서 샵 찾기
            </Text>
            <Text className="text-brand-400 text-[10px] font-bold uppercase">
              Find Dive Centers
            </Text>
          </View>
        </View>
        <Navigation size={22} color="#6B7280" />
      </Pressable>

      <Text className="text-center text-gray-400 text-xs mt-8">
        TODO: 다가오는 다이빙 카드, 내 활동 요약
      </Text>
    </ScrollView>
  );
}
