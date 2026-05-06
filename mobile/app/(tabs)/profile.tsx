import { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Award, Camera, Settings } from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useProfile } from "@/src/hooks/use-profile";
import { useFollowCounts } from "@/src/hooks/use-follows";
import { useInfiniteUserFeedsWithImages } from "@/src/hooks/use-feeds";
import { Avatar, FeedGrid } from "@/src/components";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const { data: profile } = useProfile(userId);
  const { data: followCounts } = useFollowCounts(userId);

  const {
    data: feedPages,
    isLoading: isFeedLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteUserFeedsWithImages(userId);

  const feedItems = useMemo(
    () => feedPages?.pages.flatMap((p) => p) ?? [],
    [feedPages],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasNextPage || isFetchingNextPage) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom < 400) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="flex-row justify-end px-5 pt-2">
        <Pressable
          onPress={() => router.push("/settings" as never)}
          accessibilityLabel="설정"
          hitSlop={8}
          className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-200"
        >
          <Settings size={16} color="#374151" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        onScroll={onScroll}
        scrollEventThrottle={200}
      >
       <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <View className="bg-white p-6 rounded-3xl items-center mb-4">
          <Pressable
            onPress={() => router.push("/profile/edit" as never)}
            style={{ width: 80, height: 80, marginBottom: 12 }}
          >
            <Avatar
              uri={profile?.profile_image_url}
              name={profile?.nickname ?? "Diver"}
              size={80}
            />
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "#2563EB",
                borderWidth: 2,
                borderColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={12} color="#fff" />
            </View>
          </Pressable>
          <Text className="text-2xl font-black text-gray-900 mb-1">
            {profile?.nickname ?? "Diver"}
          </Text>
          <Text className="text-xs text-gray-500 mb-3">{user?.email}</Text>
          <View className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full mb-3">
            <Award size={12} color="#2563EB" />
            <Text className="text-[10px] font-black text-brand-700">
              {profile?.diving_org ?? "—"} · {profile?.certification ?? "—"}
            </Text>
          </View>
          <View className="flex-row gap-6">
            <View className="items-center">
              <Text className="text-base font-black text-gray-900">
                {followCounts?.followers ?? 0}
              </Text>
              <Text className="text-[10px] text-gray-400 font-bold uppercase">
                팔로워
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-base font-black text-gray-900">
                {followCounts?.following ?? 0}
              </Text>
              <Text className="text-[10px] text-gray-400 font-bold uppercase">
                팔로잉
              </Text>
            </View>
          </View>

          {profile?.bio ? (
            <Text className="text-xs text-gray-600 leading-5 text-center mt-3 px-2">
              {profile.bio}
            </Text>
          ) : null}
        </View>
       </View>

        <FeedGrid
          items={feedItems}
          isLoading={isFeedLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          onPressItem={(id) =>
            router.push({ pathname: "/feed/[id]", params: { id } })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
