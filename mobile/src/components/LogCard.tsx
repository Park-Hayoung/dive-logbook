import { View, Text, Image, Pressable } from "react-native";
import { ChevronRight, Navigation, Clock } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { Dive } from "@/src/types/dive";
import { formatDate } from "@/src/lib/format";

type LogCardProps = {
  dive: Dive;
};

export function LogCard({ dive }: LogCardProps) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/log/${dive.id}`)}
      className="bg-white p-4 rounded-[2.2rem] border border-gray-100 flex-row gap-4 items-center active:scale-95"
    >
      {dive.thumbnailUrl && (
        <Image
          source={{ uri: dive.thumbnailUrl }}
          className="w-20 h-20 rounded-[1.5rem]"
        />
      )}
      <View className="flex-1 min-w-0">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="text-[10px] text-brand-600 font-black bg-brand-50 px-2 py-0.5 rounded-lg">
            #{dive.diveNumber}
          </Text>
          <Text className="text-[10px] text-gray-400 font-bold">
            {formatDate(dive.startedAt)}
          </Text>
        </View>
        <Text className="font-black text-gray-900 mb-1" numberOfLines={1}>
          {dive.location}
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-row items-center gap-1">
            <Navigation size={10} color="#4B5563" />
            <Text className="text-[10px] text-gray-600 font-bold">
              {dive.maxDepth}m
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Clock size={10} color="#4B5563" />
            <Text className="text-[10px] text-gray-600 font-bold">
              {dive.durationMinutes}분
            </Text>
          </View>
        </View>
      </View>
      <ChevronRight size={16} color="#D1D5DB" />
    </Pressable>
  );
}
