import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 bg-white items-center justify-center p-8">
      <Text className="text-3xl font-black text-brand-600 mb-2">DiveLog</Text>
      <Text className="text-sm text-gray-500 mb-12">
        다이버를 위한 로그북 + 커뮤니티
      </Text>

      <View className="w-full gap-3">
        <Pressable className="bg-yellow-300 p-4 rounded-2xl items-center">
          <Text className="font-black">카카오로 시작</Text>
        </Pressable>
        <Pressable className="bg-white border border-gray-200 p-4 rounded-2xl items-center">
          <Text className="font-black">Google로 시작</Text>
        </Pressable>
        <Pressable className="bg-black p-4 rounded-2xl items-center">
          <Text className="text-white font-black">Apple로 시작</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.replace("/(tabs)")}
        className="mt-12"
      >
        <Text className="text-xs text-gray-400 underline">
          개발용: 로그인 건너뛰기
        </Text>
      </Pressable>
    </View>
  );
}
