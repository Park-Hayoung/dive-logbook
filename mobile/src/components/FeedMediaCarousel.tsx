import { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
} from "react-native";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

import { FeedVideo } from "./FeedVideo";

export type FeedMediaItem = {
  id: string;
  url: string;
  kind: "image" | "video";
  thumbnailUrl: string | null;
};

type Props = {
  items: FeedMediaItem[];
  width: number;
  height: number;
  isActive: boolean;
  onPressMedia?: () => void;
  onPressVideo?: (url: string) => void;
};

export function FeedMediaCarousel({
  items,
  width,
  height,
  isActive,
  onPressMedia,
  onPressVideo,
}: Props) {
  const [page, setPage] = useState(0);
  const [measuredWidth, setMeasuredWidth] = useState(width);

  if (items.length === 0) return null;

  const renderItem = (m: FeedMediaItem, idx: number) => {
    const videoActive = isActive && (items.length === 1 || page === idx);
    if (m.kind === "video") {
      return (
        <FeedVideo
          videoUrl={m.url}
          thumbnailUrl={m.thumbnailUrl}
          isActive={videoActive}
          onPress={
            onPressVideo
              ? () => onPressVideo(m.url)
              : onPressMedia
          }
          style={{ width: "100%", height: "100%" }}
        />
      );
    }
    return (
      <Pressable
        onPress={onPressMedia}
        style={{ width: "100%", height: "100%" }}
      >
        <Image
          source={{ uri: m.url }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      </Pressable>
    );
  };

  if (items.length === 1) {
    return (
      <View
        style={{ width: "100%", height, marginBottom: 12 }}
        className="bg-gray-100"
      >
        {renderItem(items[0], 0)}
      </View>
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setPage(Math.round(x / measuredWidth));
  };

  return (
    <View
      className="mb-3"
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - measuredWidth) > 0.5) {
          setMeasuredWidth(w);
        }
      }}
    >
      <ScrollView
        horizontal
        snapToInterval={measuredWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {items.map((m, idx) => (
          <View
            key={m.id}
            style={{ width: measuredWidth, height }}
            className="bg-gray-100"
          >
            {renderItem(m, idx)}
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
              backgroundColor: i === page ? "#665900" : "#D1D5DB",
            }}
          />
        ))}
      </View>
    </View>
  );
}
