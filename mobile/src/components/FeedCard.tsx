import { View, Text, Pressable, Image } from "react-native";
import { Heart, MessageCircle, MapPin } from "lucide-react-native";
import type { FeedItem } from "@/src/hooks/use-feeds";

const formatRelative = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

type Props = {
  feed: FeedItem;
  onToggleLike: () => void;
  onPress?: () => void;
  onAuthorPress?: () => void;
};

export function FeedCard({ feed, onToggleLike, onPress, onAuthorPress }: Props) {
  const initial = feed.author?.nickname?.charAt(0) ?? "?";
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

      {feed.imageUrl ? (
        <Image
          source={{ uri: feed.imageUrl }}
          className="w-full h-48 rounded-2xl mb-3"
          resizeMode="cover"
        />
      ) : null}

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
    </Pressable>
  );
}
