import { View, Text, ScrollView } from "react-native";

export default function FeedScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      <Text className="text-xl font-black text-gray-900 mb-6">실시간 피드</Text>
      <View className="bg-white p-8 rounded-3xl items-center">
        <Text className="text-gray-400 text-xs">
          TODO: SNS 피드 + Q&A 게시판
        </Text>
      </View>
    </ScrollView>
  );
}
