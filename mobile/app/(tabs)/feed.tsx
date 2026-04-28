import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Pencil, Search } from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useFeeds, useToggleFeedLike } from "@/src/hooks/use-feeds";
import { FeedCard } from "@/src/components";

export default function FeedScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: feeds, isLoading, refetch, isRefetching } = useFeeds(userId);
  const toggleLike = useToggleFeedLike(userId);
  const [optimisticBusy, setOptimisticBusy] = useState<string | null>(null);

  const onToggleLike = async (feedId: string, currentlyLiked: boolean) => {
    if (optimisticBusy) return;
    setOptimisticBusy(feedId);
    try {
      await toggleLike.mutateAsync({ feedId, currentlyLiked });
    } finally {
      setOptimisticBusy(null);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <View className="flex-row justify-between items-start mb-6">
          <View>
            <Text className="text-2xl font-black text-gray-900 mb-1">
              실시간 피드
            </Text>
            <Text className="text-sm text-gray-500">
              전 세계 다이버들의 기록과 일상
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/search" as never)}
            hitSlop={8}
            className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-200"
          >
            <Search size={16} color="#374151" />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : !feeds || feeds.length === 0 ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs text-center">
              아직 피드가 없어요.{"\n"}첫 글을 남겨보세요!
            </Text>
          </View>
        ) : (
          feeds.map((feed) => (
            <FeedCard
              key={feed.id}
              feed={feed}
              onToggleLike={() => onToggleLike(feed.id, feed.myLiked)}
              onPress={() =>
                router.push({ pathname: "/feed/[id]", params: { id: feed.id } })
              }
              onAuthorPress={
                feed.author
                  ? () =>
                      router.push({
                        pathname: "/profile/[id]",
                        params: { id: feed.author!.id },
                      })
                  : undefined
              }
            />
          ))
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/feed/new")}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-brand-600 items-center justify-center shadow-lg active:scale-95"
        accessibilityLabel="새 글 작성"
      >
        <Pencil size={22} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}
