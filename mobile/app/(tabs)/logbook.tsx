import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Activity } from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useDives } from "@/src/hooks/use-dives";
import { LogCard } from "@/src/components";

export default function LogbookScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: dives, isLoading } = useDives(userId);

  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-2xl font-black text-gray-900">내 로그북</Text>
        <View className="bg-brand-50 p-2 rounded-xl">
          <Activity size={18} color="#2563EB" />
        </View>
      </View>

      {isLoading && <ActivityIndicator size="large" />}

      {!isLoading && (!dives || dives.length === 0) && (
        <View className="bg-white p-8 rounded-3xl items-center">
          <Text className="text-gray-400 text-xs">
            아직 기록된 다이브가 없습니다. + 버튼으로 첫 로그를 기록해보세요.
          </Text>
        </View>
      )}

      <View className="gap-4">
        {dives?.map((dive) => <LogCard key={dive.id} dive={dive} />)}
      </View>
    </ScrollView>
  );
}
