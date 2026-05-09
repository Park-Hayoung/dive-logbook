import { useCallback, useRef, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import type { ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Pencil, Search } from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useFeeds, useToggleFeedLike, type FeedItem } from "@/src/hooks/use-feeds";
import { FeedCard } from "@/src/components";

export default function FeedScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: feeds, isLoading, refetch, isRefetching } = useFeeds(userId);
  const toggleLike = useToggleFeedLike(userId);
  const [optimisticBusy, setOptimisticBusy] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const onToggleLike = async (feedId: string, currentlyLiked: boolean) => {
    if (optimisticBusy) return;
    setOptimisticBusy(feedId);
    try {
      await toggleLike.mutateAsync({ feedId, currentlyLiked });
    } finally {
      setOptimisticBusy(null);
    }
  };

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) {
        setActiveId(null);
        return;
      }
      const first = viewableItems[0].item as FeedItem;
      setActiveId(first.id);
    },
  ).current;

  useFocusEffect(
    useCallback(() => {
      return () => {
        setActiveId(null);
      };
    }, []),
  );

  const header = (
    <View className="flex-row justify-between items-start mb-6">
      <View>
        <Text className="text-2xl font-bold text-gray-900 mb-1">
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
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      {isLoading ? (
        <View className="flex-1 px-5 pt-5">
          {header}
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        </View>
      ) : !feeds || feeds.length === 0 ? (
        <View className="flex-1 px-5 pt-5">
          {header}
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs text-center">
              아직 피드가 없어요.{"\n"}첫 글을 남겨보세요!
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={feeds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={({ item }) => (
            <FeedCard
              feed={item}
              isActive={activeId === item.id}
              onToggleLike={() => onToggleLike(item.id, item.myLiked)}
              onPress={() =>
                router.push({ pathname: "/feed/[id]", params: { id: item.id } })
              }
              onAuthorPress={
                item.author
                  ? () =>
                      router.push({
                        pathname: "/profile/[id]",
                        params: { id: item.author!.id },
                      })
                  : undefined
              }
            />
          )}
        />
      )}

      <Pressable
        onPress={() => router.push("/feed/new")}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-brand-600 items-center justify-center shadow-lg active:scale-95"
        accessibilityLabel="새 글 작성"
      >
        <Pencil size={22} color={colors.brand.fg} />
      </Pressable>
    </SafeAreaView>
  );
}
