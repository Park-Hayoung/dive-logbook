import { View, Text, ScrollView, Pressable } from "react-native";
import { X } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function NewLogScreen() {
  const router = useRouter();
  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-2xl font-black text-gray-900">새 로그 기록</Text>
        <Pressable
          onPress={() => router.back()}
          className="p-2 bg-gray-100 rounded-full"
        >
          <X size={20} color="#374151" />
        </Pressable>
      </View>

      <View className="bg-gray-900 p-6 rounded-[2rem] mb-4">
        <Pressable className="bg-brand-600 py-4 rounded-2xl items-center">
          <Text className="text-white font-black text-sm">
            기기 연결 및 바이너리 파싱
          </Text>
        </Pressable>
      </View>

      <Text className="text-center text-gray-400 text-xs mt-8">
        TODO: react-native-ble-plx로 Shearwater 연결, 폼 입력, 저장
      </Text>
    </ScrollView>
  );
}
