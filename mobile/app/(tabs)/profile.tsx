import { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Award, Camera, Settings, Users } from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useProfile } from "@/src/hooks/use-profile";
import { useFollowCounts } from "@/src/hooks/use-follows";
import { useMyTeam } from "@/src/hooks/use-teams";
import { colors } from "@/src/lib/colors";
import {
  useInfiniteUserFeedsWithImages,
  useUserFeedCount,
} from "@/src/hooks/use-feeds";
import { Avatar, FeedGrid } from "@/src/components";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const { data: profile } = useProfile(userId);
  const { data: followCounts } = useFollowCounts(userId);
  const { data: feedCount } = useUserFeedCount(userId);
  const { data: myTeam } = useMyTeam(userId);

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
       <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <View>
          <View className="flex-row items-center">
            <Pressable
              onPress={() => router.push("/profile/edit" as never)}
              style={{ width: 80, height: 80 }}
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
                  backgroundColor: colors.brand[600],
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Camera size={12} color={colors.brand.fg} />
              </View>
            </Pressable>

            <View className="flex-1 ml-4">
              <View className="flex-row mb-3">
                <View className="flex-1 items-center">
                  <Text
                    className="text-base font-black text-gray-900"
                    numberOfLines={1}
                  >
                    {profile?.nickname ?? "Diver"}
                  </Text>
                </View>
                <View className="flex-1" />
                <View className="flex-1" />
              </View>
              <View className="flex-row">
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-black text-gray-900">
                    {feedCount ?? 0}
                  </Text>
                  <Text className="text-sm text-gray-700 mt-1">게시물</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-black text-gray-900">
                    {followCounts?.followers ?? 0}
                  </Text>
                  <Text className="text-sm text-gray-700 mt-1">팔로워</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-black text-gray-900">
                    {followCounts?.following ?? 0}
                  </Text>
                  <Text className="text-sm text-gray-700 mt-1">팔로잉</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="mt-4">
            <View className="flex-row flex-wrap gap-1.5">
              {profile?.certification || profile?.diving_org ? (
                <View className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full">
                  <Award size={12} color={colors.brand[700]} />
                  <Text className="text-[10px] font-black text-brand-700">
                    {[profile?.diving_org, profile?.certification]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              ) : null}
              {myTeam?.team ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/team/[id]",
                      params: { id: myTeam.team!.id },
                    })
                  }
                  className="flex-row items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full"
                >
                  <Users size={12} color="#374151" />
                  <Text className="text-[10px] font-black text-gray-700">
                    {myTeam.team.name}
                    {myTeam.role === "leader" ? " · 리더" : ""}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {profile?.bio ? (
              <Text className="text-xs text-gray-600 leading-5 mt-2">
                {profile.bio}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => router.push("/profile/edit" as never)}
            className="mt-4 bg-gray-100 py-2.5 rounded-xl items-center"
          >
            <Text className="text-xs font-black text-gray-700">
              프로필 편집
            </Text>
          </Pressable>
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
