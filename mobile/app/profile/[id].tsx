import { useMemo, useState } from "react";
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
import { useInfiniteUserFeedsWithImages } from "@/src/hooks/use-feeds";
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
       <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <View className="bg-white p-6 rounded-3xl items-center mb-4">
          <View className="mb-3">
            <Avatar
              uri={profile.profile_image_url}
              name={profile.nickname}
              size={80}
            />
          </View>
          <Text className="text-2xl font-black text-gray-900 mb-1">
            {profile.nickname}
          </Text>
          <View className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full mb-3">
            <Award size={12} color="#2563EB" />
            <Text className="text-[10px] font-black text-brand-700">
              {profile.diving_org ?? "—"} · {profile.certification ?? "—"}
            </Text>
          </View>

          <View className="flex-row gap-6 mb-4">
            <View className="items-center">
              <Text className="text-base font-black text-gray-900">
                {counts?.followers ?? 0}
              </Text>
              <Text className="text-[10px] text-gray-400 font-bold uppercase">
                팔로워
              </Text>
            </View>
            <View className="items-center">
              <Text className="text-base font-black text-gray-900">
                {counts?.following ?? 0}
              </Text>
              <Text className="text-[10px] text-gray-400 font-bold uppercase">
                팔로잉
              </Text>
            </View>
          </View>

          {!isMe ? (
            <Pressable
              onPress={onToggleFollow}
              disabled={busy || !myUserId}
              className={`flex-row items-center gap-2 px-5 py-3 rounded-2xl ${
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
                <UserPlus size={14} color="#fff" />
              )}
              <Text
                className={`font-black text-sm ${
                  isFollowing ? "text-gray-700" : "text-white"
                }`}
              >
                {isFollowing ? "팔로잉" : "팔로우"}
              </Text>
            </Pressable>
          ) : (
            <Text className="text-[10px] text-gray-400">내 프로필</Text>
          )}

          {profile.bio ? (
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
          emptyHint="아직 등록한 피드가 없어요"
          onPressItem={(feedId) =>
            router.push({ pathname: "/feed/[id]", params: { id: feedId } })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
