import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import Svg, { Path, Circle } from "react-native-svg";
import * as ImageManipulator from "expo-image-manipulator";

import { colors } from "@/src/lib/colors";

type Props = {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onConfirm: (croppedUri: string, mimeType: string) => void;
};

const MIN_USER_SCALE = 1;
const MAX_USER_SCALE = 5;

// 사각형 크롭 박스에서 원형 마스크가 가려야 할 영역 = 사각형 - 원.
// SVG <Path> + evenodd 채우기로 도넛 형태 어두운 오버레이를 만든다.
const buildDonutPath = (size: number) => {
  const r = size / 2;
  const cx = size / 2;
  const cy = size / 2;
  return [
    `M0 0 H${size} V${size} H0 Z`,
    `M${cx} ${cy - r}`,
    `A${r} ${r} 0 1 0 ${cx} ${cy + r}`,
    `A${r} ${r} 0 1 0 ${cx} ${cy - r}`,
    `Z`,
  ].join(" ");
};

export function AvatarCropModal({ visible, uri, onCancel, onConfirm }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const SQUARE = Math.min(winW - 32, winH - 280);

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  useEffect(() => {
    if (!uri) {
      setImgSize(null);
      return;
    }
    Image.getSize(
      uri,
      (w, h) => setImgSize({ w, h }),
      () => setImgSize(null),
    );
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }, [uri, scale, savedScale, tx, ty, savedTx, savedTy]);

  // cover scale: 짧은 변이 박스에 딱 맞도록 → 빈 공간 없이 시작.
  const coverScale = imgSize
    ? SQUARE / Math.min(imgSize.w, imgSize.h)
    : 1;
  const dispW = imgSize ? imgSize.w * coverScale : SQUARE;
  const dispH = imgSize ? imgSize.h * coverScale : SQUARE;

  const pinch = Gesture.Pinch()
    .onStart(() => {
      "worklet";
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      "worklet";
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      "worklet";
      if (scale.value < MIN_USER_SCALE) scale.value = MIN_USER_SCALE;
      if (scale.value > MAX_USER_SCALE) scale.value = MAX_USER_SCALE;
      const maxTx = Math.max(0, (dispW * scale.value - SQUARE) / 2);
      const maxTy = Math.max(0, (dispH * scale.value - SQUARE) / 2);
      if (tx.value > maxTx) tx.value = maxTx;
      if (tx.value < -maxTx) tx.value = -maxTx;
      if (ty.value > maxTy) ty.value = maxTy;
      if (ty.value < -maxTy) ty.value = -maxTy;
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      "worklet";
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      "worklet";
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      "worklet";
      const maxTx = Math.max(0, (dispW * scale.value - SQUARE) / 2);
      const maxTy = Math.max(0, (dispH * scale.value - SQUARE) / 2);
      if (tx.value > maxTx) tx.value = maxTx;
      if (tx.value < -maxTx) tx.value = -maxTx;
      if (ty.value > maxTy) ty.value = maxTy;
      if (ty.value < -maxTy) ty.value = -maxTy;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const handleConfirm = async () => {
    if (!uri || !imgSize) return;
    setProcessing(true);
    try {
      const totalScale = coverScale * scale.value;
      const imgCropSize = SQUARE / totalScale;
      const originX =
        imgSize.w / 2 - tx.value / totalScale - imgCropSize / 2;
      const originY =
        imgSize.h / 2 - ty.value / totalScale - imgCropSize / 2;

      const safeOriginX = Math.max(0, Math.floor(originX));
      const safeOriginY = Math.max(0, Math.floor(originY));
      const safeWidth = Math.min(
        Math.floor(imgCropSize),
        imgSize.w - safeOriginX,
      );
      const safeHeight = Math.min(
        Math.floor(imgCropSize),
        imgSize.h - safeOriginY,
      );

      const out = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: safeOriginX,
              originY: safeOriginY,
              width: safeWidth,
              height: safeHeight,
            },
          },
          { resize: { width: 800 } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      onConfirm(out.uri, "image/jpeg");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "black" }}>
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-white/90 text-base font-bold mb-4">
            프로필 사진 자르기
          </Text>

          <View
            style={{
              width: SQUARE,
              height: SQUARE,
              overflow: "hidden",
              backgroundColor: "#111",
            }}
          >
            {uri && imgSize ? (
              <GestureDetector gesture={composed}>
                <Animated.View
                  style={[
                    {
                      width: SQUARE,
                      height: SQUARE,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    animatedStyle,
                  ]}
                >
                  <Image
                    source={{ uri }}
                    style={{ width: dispW, height: dispH }}
                  />
                </Animated.View>
              </GestureDetector>
            ) : (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="white" />
              </View>
            )}

            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <Svg width={SQUARE} height={SQUARE}>
                <Path
                  d={buildDonutPath(SQUARE)}
                  fill="rgba(0,0,0,0.55)"
                  fillRule="evenodd"
                />
                <Circle
                  cx={SQUARE / 2}
                  cy={SQUARE / 2}
                  r={SQUARE / 2 - 1}
                  stroke="white"
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                  fill="none"
                />
              </Svg>
            </View>
          </View>

          <Text className="text-white/70 text-xs mt-4 text-center leading-5">
            점선 안쪽이 프로필에 표시되는 영역이에요{"\n"}
            손가락으로 옮기거나 두 손가락으로 확대할 수 있어요
          </Text>

          <View className="flex-row gap-3 mt-8 w-full">
            <Pressable
              onPress={onCancel}
              disabled={processing}
              className="flex-1 bg-white/10 rounded-2xl p-4 items-center"
            >
              <Text className="text-white font-bold">취소</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={processing || !imgSize}
              className="flex-1 bg-brand-600 rounded-2xl p-4 items-center"
            >
              {processing ? (
                <ActivityIndicator color={colors.brand.fg} />
              ) : (
                <Text
                  style={{ color: colors.brand.fg }}
                  className="font-bold"
                >
                  사용하기
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
