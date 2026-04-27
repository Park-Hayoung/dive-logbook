import { View, Text, ScrollView, Pressable } from "react-native";
import { useAuthStore } from "@/src/store/auth-store";

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      <View className="bg-white p-6 rounded-3xl items-center mb-6">
        <Text className="text-2xl font-black text-gray-900 mb-1">
          {user?.email ?? "Guest"}
        </Text>
        <Text className="text-xs text-gray-400 font-bold uppercase">
          PADI • Advanced Open Water
        </Text>
      </View>

      <Text className="text-center text-gray-400 text-xs mb-6">
        TODO: 통계 위젯, QR 네트워킹, 팔로워 관리
      </Text>

      <Pressable
        onPress={signOut}
        className="bg-gray-900 p-4 rounded-2xl items-center"
      >
        <Text className="text-white font-black">로그아웃</Text>
      </Pressable>
    </ScrollView>
  );
}
