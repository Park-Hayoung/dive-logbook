import {
  View,
  Text,
  Pressable,
  Image,
  Dimensions,
} from "react-native";
import { Heart, MessageCircle, MapPin } from "lucide-react-native";

import type { FeedItem } from "@/src/hooks/use-feeds";
import { useDiveMedia } from "@/src/hooks/use-dive-media";
import {
  FeedMediaCarousel,
  type FeedMediaItem,
} from "@/src/components/FeedMediaCarousel";

const formatRelative = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

// FeedCard sits in a ScrollView with horizontal padding 20, and its own p-4 = 16.
// So image area width = screen - 40 - 32.
const SCREEN_WIDTH = Dimensions.get("window").width;
const MEDIA_WIDTH = SCREEN_WIDTH - 40 - 32;
const MEDIA_HEIGHT = 240;

type Props = {
  feed: FeedItem;
  onToggleLike: () => void;
  onPress?: () => void;
  onAuthorPress?: () => void;
  isActive?: boolean;
};

export function FeedCard({
  feed,
  onToggleLike,
  onPress,
  onAuthorPress,
  isActive,
}: Props) {
  const initial = feed.author?.nickname?.charAt(0) ?? "?";

  const { data: diveMedia = [] } = useDiveMedia(
    feed.linkedDiveId ?? undefined,
  );

  const items: FeedMediaItem[] =
    feed.linkedDiveId && diveMedia.length > 0
      ? diveMedia.map((m) => ({
          id: m.id,
          url: m.storageUrl,
          kind: m.kind,
          thumbnailUrl: m.thumbnailUrl,
        }))
      : feed.imageUrl
        ? [
            {
              id: "feed-image",
              url: feed.imageUrl,
              kind: "image",
              thumbnailUrl: null,
            },
          ]
        : [];

  return (
    <Pressable
      onPress={onPress}
      className="bg-white p-4 rounded-3xl border border-gray-100 mb-3"
    >
      <Pressable
        onPress={(e) => {
          if (!onAuthorPress) return;
          e.stopPropagation();
          onAuthorPress();
        }}
        className="flex-row items-center gap-3 mb-3"
      >
        <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
          {feed.author?.profileImageUrl ? (
            <Image
              source={{ uri: feed.author.profileImageUrl }}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <Text className="text-base font-black text-brand-600">
              {initial}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="font-black text-sm text-gray-900">
            {feed.author?.nickname ?? "Unknown"}
          </Text>
          <Text className="text-[10px] text-gray-400">
            {formatRelative(feed.createdAt)}
            {feed.location ? ` · ${feed.location}` : ""}
          </Text>
        </View>
        {feed.type === "log" ? (
          <View className="bg-brand-50 px-2 py-1 rounded-lg">
            <Text className="text-[10px] font-black text-brand-700">LOG</Text>
          </View>
        ) : null}
      </Pressable>

      {feed.content ? (
        <Text className="text-sm text-gray-800 leading-5 mb-3">
          {feed.content}
        </Text>
      ) : null}

      <FeedMediaCarousel
        items={items}
        width={MEDIA_WIDTH}
        height={MEDIA_HEIGHT}
        isActive={!!isActive}
        onPressMedia={onPress}
        onPressVideo={onPress ? () => onPress() : undefined}
      />

      {feed.location && !feed.content ? (
        <View className="flex-row items-center gap-1.5 mb-3">
          <MapPin size={12} color="#6B7280" />
          <Text className="text-xs text-gray-600">{feed.location}</Text>
        </View>
      ) : null}

      <View className="flex-row items-center gap-4 pt-2 border-t border-gray-100">
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleLike();
          }}
          className="flex-row items-center gap-1.5"
          hitSlop={8}
        >
          <Heart
            size={16}
            color={feed.myLiked ? "#EF4444" : "#9CA3AF"}
            fill={feed.myLiked ? "#EF4444" : "transparent"}
          />
          <Text
            className={`text-xs font-bold ${
              feed.myLiked ? "text-red-500" : "text-gray-500"
            }`}
          >
            {feed.likeCount}
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-1.5">
          <MessageCircle size={16} color="#9CA3AF" />
          <Text className="text-xs font-bold text-gray-500">
            {feed.commentCount}
          </Text>
        </View>
      </View>

      {feed.recentComments.length > 0 ? (
        <View className="mt-2 gap-1">
          {feed.commentCount > feed.recentComments.length ? (
            <Text className="text-xs text-gray-400">
              댓글 {feed.commentCount}개 모두 보기
            </Text>
          ) : null}
          {feed.recentComments.map((c) => (
            <View key={c.id} className="flex-row gap-1.5">
              <Text className="text-xs font-black text-gray-900">
                {c.author?.nickname ?? "Unknown"}
              </Text>
              <Text
                className="text-xs text-gray-700 flex-1"
                numberOfLines={2}
              >
                {c.content}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
