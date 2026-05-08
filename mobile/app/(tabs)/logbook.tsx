import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bluetooth } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useDives } from "@/src/hooks/use-dives";
import { LogCard } from "@/src/components";

export default function LogbookScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: dives, isLoading } = useDives(userId);
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-black text-gray-900">내 로그북</Text>
          <Pressable
            onPress={() => router.push("/log/import")}
            accessibilityLabel="다이브 컴퓨터에서 가져오기"
            className="flex-row items-center gap-1.5 bg-brand-600 px-3 py-2 rounded-xl active:scale-95"
          >
            <Bluetooth size={14} color="#fff" />
            <Text className="text-xs font-black text-white">가져오기</Text>
          </Pressable>
        </View>

        {isLoading && <ActivityIndicator size="large" />}

        {!isLoading && (!dives || dives.length === 0) && (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs">
              아직 기록된 다이브가 없어요. + 버튼으로 첫 로그를 기록해보세요.
            </Text>
          </View>
        )}

        <View className="gap-4">
          {dives?.map((dive) => <LogCard key={dive.id} dive={dive} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
