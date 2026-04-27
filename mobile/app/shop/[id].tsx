import { View, Text, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      <Text className="text-2xl font-black">샵 상세</Text>
      <Text className="text-gray-400 text-xs mt-2">Shop ID: {id}</Text>
      <Text className="text-center text-gray-400 text-xs mt-8">
        TODO: 샵 정보, 다중일 캘린더 예약, 예약 문의 폼
      </Text>
    </ScrollView>
  );
}
