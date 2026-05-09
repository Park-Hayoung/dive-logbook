import { useMemo, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Award,
  UserPlus,
  UserMinus,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useProfile } from "@/src/hooks/use-profile";
import {
  useFollowCounts,
  useIsFollowing,
  useToggleFollow,
} from "@/src/hooks/use-follows";
import {
  useInfiniteUserFeedsWithImages,
  useUserFeedCount,
} from "@/src/hooks/use-feeds";
import { Avatar, FeedGrid } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myUserId = useAuthStore((s) => s.user?.id);

  const isMe = !!myUserId && myUserId === id;
  const { data: profile, isLoading } = useProfile(id);
  const { data: counts } = useFollowCounts(id);
  const { data: feedCount } = useUserFeedCount(id);
  const { data: isFollowing = false } = useIsFollowing(myUserId, id);
  const toggleFollow = useToggleFollow(myUserId);

  const {
    data: feedPages,
    isLoading: isFeedLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteUserFeedsWithImages(id);

  const feedItems = useMemo(
    () => feedPages?.pages.flatMap((p) => p) ?? [],
    [feedPages],
  );

  const [busy, setBusy] = useState(false);

  const onToggleFollow = async () => {
    if (!id || !myUserId || isMe) return;
    setBusy(true);
    try {
      await toggleFollow.mutateAsync({
        targetUserId: id,
        currentlyFollowing: isFollowing,
      });
    } catch (err: unknown) {
      showAlert("처리 실패", friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasNextPage || isFetchingNextPage) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom < 400) {
      fetchNextPage();
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-gray-400 mb-4">프로필을 찾을 수 없어요.</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-gray-900 px-5 py-3 rounded-2xl"
        >
          <Text className="text-white font-black">돌아가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base flex-1">
          {profile.nickname}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        onScroll={onScroll}
        scrollEventThrottle={200}
      >
       <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
        <View>
          <View className="flex-row items-center">
            <Avatar
              uri={profile.profile_image_url}
              name={profile.nickname}
              size={80}
            />

            <View className="flex-1 ml-4">
              <View className="flex-row mb-3">
                <View className="flex-1 items-center">
                  <Text
                    className="text-base font-black text-gray-900"
                    numberOfLines={1}
                  >
                    {profile.nickname}
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
                    {counts?.followers ?? 0}
                  </Text>
                  <Text className="text-sm text-gray-700 mt-1">팔로워</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-black text-gray-900">
                    {counts?.following ?? 0}
                  </Text>
                  <Text className="text-sm text-gray-700 mt-1">팔로잉</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="mt-4">
            <View className="flex-row">
              <View className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full">
                <Award size={12} color={colors.brand[700]} />
                <Text className="text-[10px] font-black text-brand-700">
                  {profile.diving_org ?? "—"} · {profile.certification ?? "—"}
                </Text>
              </View>
            </View>

            {profile.bio ? (
              <Text className="text-xs text-gray-600 leading-5 mt-2">
                {profile.bio}
              </Text>
            ) : null}
          </View>

          {!isMe ? (
            <Pressable
              onPress={onToggleFollow}
              disabled={busy || !myUserId}
              className={`mt-4 flex-row items-center justify-center gap-2 py-2.5 rounded-xl ${
                isFollowing ? "bg-gray-100" : "bg-brand-600"
              }`}
            >
              {busy ? (
                <ActivityIndicator
                  size="small"
                  color={isFollowing ? "#374151" : "#fff"}
                />
              ) : isFollowing ? (
                <UserMinus size={14} color="#374151" />
              ) : (
                <UserPlus size={14} color={colors.brand.fg} />
              )}
              <Text
                className={`font-black text-xs ${
                  isFollowing ? "text-gray-700" : "text-brand-fg"
                }`}
              >
                {isFollowing ? "팔로잉" : "팔로우"}
              </Text>
            </Pressable>
          ) : null}
        </View>

       </View>

        <FeedGrid
          items={feedItems}
          isLoading={isFeedLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          emptyHint="아직 등록한 피드가 없어요"
          onPressItem={(feedId) =>
            router.push({ pathname: "/feed/[id]", params: { id: feedId } })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
