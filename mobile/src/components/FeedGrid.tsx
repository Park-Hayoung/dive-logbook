import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { ImageOff, Images } from "lucide-react-native";

import type { FeedThumb } from "@/src/hooks/use-feeds";
import { VideoThumb } from "@/src/components/VideoThumb";

const GRID_GAP = 2;
const GRID_COLUMNS = 3;

type Props = {
  items: FeedThumb[];
  isLoading: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  emptyHint?: string;
  onPressItem: (id: string) => void;
};

export function FeedGrid({
  items,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  emptyHint = "아직 등록한 피드가 없어요",
  onPressItem,
}: Props) {
  const screenWidth = Dimensions.get("window").width;
  const totalGap = GRID_GAP * (GRID_COLUMNS - 1);
  const tileSize = Math.floor((screenWidth - totalGap) / GRID_COLUMNS);

  if (isLoading) {
    return (
      <View className="bg-white py-12 items-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View className="bg-white py-12 items-center">
        <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mb-3">
          <ImageOff size={20} color="#9CA3AF" />
        </View>
        <Text className="text-sm font-bold text-gray-700 mb-1">{emptyHint}</Text>
        <Text className="text-[11px] text-gray-400 text-center px-6">
          피드 탭에서 사진과 함께 다이빙 순간을 공유해보세요
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
        {items.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => onPressItem(m.id)}
            style={{ width: tileSize, height: tileSize }}
            className="bg-gray-100 active:opacity-70"
          >
            {m.kind === "video" && m.videoUrl ? (
              <VideoThumb
                videoUrl={m.videoUrl}
                thumbnailUrl={m.imageUrl}
                style={{ width: "100%", height: "100%" }}
                playIconSize={14}
              />
            ) : m.imageUrl ? (
              <Image
                source={{ uri: m.imageUrl }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : null}
            {m.hasMultipleMedia ? (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  shadowColor: "#000",
                  shadowOpacity: 0.4,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                }}
              >
                <Images size={18} color="#fff" />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      {isFetchingNextPage ? (
        <View className="items-center py-3">
          <ActivityIndicator />
        </View>
      ) : hasNextPage ? (
        <View className="items-center py-2">
          <Text className="text-[10px] text-gray-400">스크롤해서 더 보기</Text>
        </View>
      ) : null}
    </View>
  );
}
