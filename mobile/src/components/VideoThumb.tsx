import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import type { ImageStyle, StyleProp } from "react-native";
import { Play } from "lucide-react-native";
import * as VideoThumbnails from "expo-video-thumbnails";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

const isUsable = (url: string | null | undefined): url is string => {
  if (!url) return false;
  if (url.startsWith("file://")) return false;
  return true;
};

async function generate(videoUrl: string): Promise<string | null> {
  if (cache.has(videoUrl)) return cache.get(videoUrl)!;
  const existing = inflight.get(videoUrl);
  if (existing) return existing;
  const p = (async () => {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, {
        time: 1000,
        quality: 0.6,
      });
      cache.set(videoUrl, uri);
      return uri;
    } catch {
      return null;
    } finally {
      inflight.delete(videoUrl);
    }
  })();
  inflight.set(videoUrl, p);
  return p;
}

type Props = {
  videoUrl: string;
  thumbnailUrl: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain";
  showPlayIcon?: boolean;
  playIconSize?: number;
};

export function VideoThumb({
  videoUrl,
  thumbnailUrl,
  style,
  resizeMode = "cover",
  showPlayIcon = true,
  playIconSize = 18,
}: Props) {
  const stored = isUsable(thumbnailUrl) ? thumbnailUrl : null;
  const [generated, setGenerated] = useState<string | null>(
    !stored && isUsable(videoUrl) ? (cache.get(videoUrl) ?? null) : null,
  );

  useEffect(() => {
    if (stored) return;
    if (!isUsable(videoUrl)) return;
    if (cache.has(videoUrl)) {
      setGenerated(cache.get(videoUrl)!);
      return;
    }
    let mounted = true;
    generate(videoUrl).then((uri) => {
      if (mounted) setGenerated(uri);
    });
    return () => {
      mounted = false;
    };
  }, [stored, videoUrl]);

  const uri = stored ?? generated;

  return (
    <View style={[{ backgroundColor: "#E5E7EB" }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode={resizeMode}
        />
      ) : null}
      {showPlayIcon ? (
        <View className="absolute inset-0 items-center justify-center">
          <View
            style={{
              width: playIconSize * 2.6,
              height: playIconSize * 2.6,
              borderRadius: playIconSize * 1.3,
              backgroundColor: "rgba(0,0,0,0.5)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={playIconSize} color="#fff" />
          </View>
        </View>
      ) : null}
    </View>
  );
}
