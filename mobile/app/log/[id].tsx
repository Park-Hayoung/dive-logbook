import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { useDive } from "@/src/hooks/use-dives";

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: dive, isLoading } = useDive(id);

  if (isLoading) return <ActivityIndicator className="flex-1" />;

  if (!dive) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-400">로그를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      <Text className="text-3xl font-black text-gray-900">
        {dive.country} {dive.location}
      </Text>
      <Text className="text-lg font-bold text-brand-600 mt-1 mb-6">
        ⚓ {dive.point}
      </Text>
      <Text className="text-center text-gray-400 text-xs mt-8">
        TODO: Hero 이미지, StatBox 그리드, Dive Diary, Buddy/Equipment 태그
      </Text>
    </ScrollView>
  );
}
