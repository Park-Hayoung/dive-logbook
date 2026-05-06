import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { Heart, MessageCircle, MapPin, Play } from "lucide-react-native";

import type { FeedItem } from "@/src/hooks/use-feeds";
import { useDiveMedia } from "@/src/hooks/use-dive-media";

// Legacy rows may have stored a device-local file:// URI as thumbnail_url —
// won't load on other devices. Treat as missing.
const safeThumb = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("file://")) return null;
  return url;
};

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
};

type CarouselItem = {
  id: string;
  url: string;
  kind: "image" | "video";
};

export function FeedCard({ feed, onToggleLike, onPress, onAuthorPress }: Props) {
  const initial = feed.author?.nickname?.charAt(0) ?? "?";

  const { data: diveMedia = [] } = useDiveMedia(
    feed.linkedDiveId ?? undefined,
  );

  const items: CarouselItem[] =
    feed.linkedDiveId && diveMedia.length > 0
      ? diveMedia.map((m) => ({
          id: m.id,
          url:
            m.kind === "image"
              ? m.storageUrl
              : (safeThumb(m.thumbnailUrl) ?? ""),
          kind: m.kind,
        }))
      : feed.imageUrl
        ? [{ id: "feed-image", url: feed.imageUrl, kind: "image" }]
        : [];

  const [page, setPage] = useState(0);
  const onMediaScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setPage(Math.round(x / MEDIA_WIDTH));
  };

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

      {items.length === 1 ? (
        <View
          style={{ width: "100%", height: MEDIA_HEIGHT, marginBottom: 12 }}
          className="bg-gray-100"
        >
          <Image
            source={{ uri: items[0].url }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
          {items[0].kind === "video" ? (
            <View className="absolute inset-0 items-center justify-center">
              <View className="w-12 h-12 rounded-full bg-black/50 items-center justify-center">
                <Play size={18} color="#fff" />
              </View>
            </View>
          ) : null}
        </View>
      ) : items.length > 1 ? (
        <View className="mb-3">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onMediaScroll}
            scrollEventThrottle={16}
          >
            {items.map((m) => (
              <View
                key={m.id}
                style={{ width: MEDIA_WIDTH, height: MEDIA_HEIGHT }}
                className="bg-gray-100"
              >
                <Image
                  source={{ uri: m.url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                {m.kind === "video" ? (
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="w-12 h-12 rounded-full bg-black/50 items-center justify-center">
                      <Play size={18} color="#fff" />
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              backgroundColor: "rgba(0,0,0,0.55)",
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text className="text-white text-[10px] font-bold">
              {page + 1} / {items.length}
            </Text>
          </View>
          <View className="flex-row justify-center gap-1 mt-2">
            {items.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === page ? "#2563EB" : "#D1D5DB",
                }}
              />
            ))}
          </View>
        </View>
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
