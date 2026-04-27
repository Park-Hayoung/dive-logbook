import { View, Text } from "react-native";

export default function OnboardingScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center p-8">
      <Text className="text-2xl font-black mb-4">프로필 설정</Text>
      <Text className="text-gray-400 text-xs">
        TODO: 닉네임, 자격등급, 누적횟수, 팀 검색/개설
      </Text>
    </View>
  );
}
