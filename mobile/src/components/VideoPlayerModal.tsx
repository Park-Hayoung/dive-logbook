import { useEffect } from "react";
import { Modal, View, Pressable, Dimensions } from "react-native";
import { X } from "lucide-react-native";
import { VideoView, useVideoPlayer } from "expo-video";

type Props = {
  url: string | null;
  onClose: () => void;
};

export function VideoPlayerModal({ url, onClose }: Props) {
  const { width, height } = Dimensions.get("window");

  const player = useVideoPlayer(url ?? "", (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (url) {
      player.play();
    } else {
      player.pause();
    }
  }, [url, player]);

  return (
    <Modal
      visible={!!url}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black items-center justify-center">
        <Pressable
          onPress={onClose}
          className="absolute top-12 right-5 z-10 w-10 h-10 rounded-full bg-white/15 items-center justify-center"
          hitSlop={12}
        >
          <X size={22} color="#fff" />
        </Pressable>
        {url ? (
          <VideoView
            player={player}
            style={{ width, height: height * 0.85 }}
            contentFit="contain"
            allowsPictureInPicture={false}
            nativeControls
            fullscreenOptions={{ enable: true }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
