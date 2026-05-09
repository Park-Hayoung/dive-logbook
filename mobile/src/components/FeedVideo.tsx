import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import type { ViewStyle, StyleProp } from "react-native";
import { Volume2, VolumeX } from "lucide-react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import { useFeedVideoStore } from "@/src/store/feed-video-store";

type Props = {
  videoUrl: string;
  thumbnailUrl?: string | null;
  isActive: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

const isUsableThumb = (url: string | null | undefined): url is string =>
  !!url && !url.startsWith("file://");

export function FeedVideo({
  videoUrl,
  thumbnailUrl,
  isActive,
  style,
  onPress,
}: Props) {
  const muted = useFeedVideoStore((s) => s.muted);
  const toggleMuted = useFeedVideoStore((s) => s.toggleMuted);
  const [showPoster, setShowPoster] = useState(true);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (isActive) {
      player.muted = muted;
      player.play();
    } else {
      player.pause();
      setShowPoster(true);
    }
  }, [isActive, player, muted]);

  useEffect(() => {
    const sub = player.addListener("timeUpdate", ({ currentTime }) => {
      if (currentTime > 0.05 && showPoster) setShowPoster(false);
    });
    return () => sub.remove();
  }, [player, showPoster]);

  const poster = isUsableThumb(thumbnailUrl) ? thumbnailUrl : null;

  return (
    <View style={style}>
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        nativeControls={false}
      />
      {showPoster && poster ? (
        <Image
          source={{ uri: poster }}
          style={{ position: "absolute", width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : null}
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      ) : null}
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          toggleMuted();
        }}
        hitSlop={8}
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {muted ? (
          <VolumeX size={14} color="#fff" />
        ) : (
          <Volume2 size={14} color="#fff" />
        )}
      </Pressable>
    </View>
  );
}
