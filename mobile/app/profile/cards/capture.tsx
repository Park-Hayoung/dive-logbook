import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, RotateCcw, Image as ImageIcon } from "lucide-react-native";

import { colors } from "@/src/lib/colors";
import { showAlert } from "@/src/lib/alert";

// CR80 (ISO/IEC 7810 ID-1) — actual diving C-cards & Korean ID cards.
// 85.6 × 53.98 mm → 1.586 aspect.
const CARD_ASPECT = 85.6 / 53.98;

// Portrait camera preview ratio used on most phones.
const PREVIEW_RATIO = 4 / 3;

export default function CardCaptureScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  // Compute the card-frame rectangle in screen px so the overlay matches what
  // we'll later crop from the captured photo. We render the camera preview at
  // the full screen width, height = width * 4/3, and inset the card frame.
  const screenWidth = Dimensions.get("window").width;
  const previewWidth = screenWidth;
  const previewHeight = previewWidth * PREVIEW_RATIO;
  const frameWidth = previewWidth * 0.86;
  const frameHeight = frameWidth / CARD_ASPECT;
  const frameLeft = (previewWidth - frameWidth) / 2;
  const frameTop = (previewHeight - frameHeight) / 2;

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // After capture (or gallery pick), crop the photo to the card frame and
  // route back to /profile/cards/add with the cropped URI.
  const finalize = async (rawUri: string, rawW: number, rawH: number) => {
    try {
      // Map screen-space frame → image-space crop rectangle.
      // The camera sensor is rotated to portrait, so the image is rawW x rawH
      // (where rawH > rawW for portrait shots). We assume the preview's
      // displayed area maps 1:1 (with letterboxing) onto the image.
      const previewAspect = previewWidth / previewHeight;
      const imageAspect = rawW / rawH;

      // Find what part of the image is *visible* in the preview (cover fit).
      let visibleW: number;
      let visibleH: number;
      let offsetX = 0;
      let offsetY = 0;
      if (imageAspect > previewAspect) {
        // image is wider than preview — sides are cropped
        visibleH = rawH;
        visibleW = rawH * previewAspect;
        offsetX = (rawW - visibleW) / 2;
      } else {
        visibleW = rawW;
        visibleH = rawW / previewAspect;
        offsetY = (rawH - visibleH) / 2;
      }

      const scale = visibleW / previewWidth;
      const cropX = offsetX + frameLeft * scale;
      const cropY = offsetY + frameTop * scale;
      const cropW = frameWidth * scale;
      const cropH = frameHeight * scale;

      const out = await ImageManipulator.manipulateAsync(
        rawUri,
        [
          {
            crop: {
              originX: Math.max(0, Math.floor(cropX)),
              originY: Math.max(0, Math.floor(cropY)),
              width: Math.floor(cropW),
              height: Math.floor(cropH),
            },
          },
          // Cap long edge to ~1600px so storage stays small. Cards don't
          // need 4K resolution for verification.
          { resize: { width: 1600 } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      // source=camera 로 add 화면에 실물 카드 디폴트를 알려준다.
      const params: Record<string, string> = {
        uri: out.uri,
        source: "camera",
      };
      if (from) params.from = from;
      router.replace({
        pathname: "/profile/cards/add" as never,
        params,
      } as never);
    } catch (err) {
      showAlert("처리 실패", "이미지를 잘라내지 못했어요. 다시 시도해주세요.");
      console.error("[card-capture] crop failed", err);
    }
  };

  const onCapture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo) return;
      await finalize(photo.uri, photo.width, photo.height);
    } catch (err) {
      console.error("[card-capture] takePicture failed", err);
      showAlert("촬영 실패", "다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const onPickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("권한 필요", "사진 라이브러리 접근 권한을 허용해주세요.");
      return;
    }
    // No forced crop — e카드(스크린샷) 는 본체+만료일·강사 등 메타가 한 화면에
    // 같이 들어가 있어 비율 강제하면 정보가 잘림. 사용자가 의도적으로 잘라두고
    // 싶으면 갤러리/사진 앱에서 미리 처리 후 가져오면 됨.
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;
    setBusy(true);
    try {
      const out = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      // source=gallery 로 add 화면에 e카드 디폴트를 알려준다.
      const params: Record<string, string> = {
        uri: out.uri,
        source: "gallery",
      };
      if (from) params.from = from;
      router.replace({
        pathname: "/profile/cards/add" as never,
        params,
      } as never);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-black px-6 items-center justify-center">
        <Text className="text-white text-base font-bold mb-3 text-center">
          카메라 권한이 필요해요
        </Text>
        <Text className="text-gray-300 text-xs text-center mb-6 leading-5">
          자격증 카드를 촬영하려면 카메라 접근을 허용해주세요.{"\n"}
          설정에서 직접 허용하거나, 갤러리 사진을 사용해도 돼요.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="bg-brand-600 px-5 py-3 rounded-2xl mb-3"
        >
          <Text className="text-brand-fg font-black">카메라 권한 요청</Text>
        </Pressable>
        <Pressable onPress={onPickFromGallery} className="px-5 py-3">
          <Text className="text-white text-xs font-bold underline">
            갤러리에서 선택
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView edges={["top"]} className="absolute top-0 left-0 right-0 z-20">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
          >
            <ChevronLeft size={22} color="#fff" />
          </Pressable>
          <Text className="text-white text-sm font-black">자격증 촬영</Text>
          <View className="w-10" />
        </View>
      </SafeAreaView>

      <View
        style={{
          width: previewWidth,
          height: previewHeight,
          marginTop: 60,
          backgroundColor: "#000",
        }}
      >
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          ratio="4:3"
        />

        {/* Dim everything except the card frame */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: frameTop,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: frameTop + frameHeight,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: frameTop,
            left: 0,
            width: frameLeft,
            height: frameHeight,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: frameTop,
            right: 0,
            width: frameLeft,
            height: frameHeight,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />

        {/* Card-shaped guide rectangle */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: frameTop,
            left: frameLeft,
            width: frameWidth,
            height: frameHeight,
            borderWidth: 2,
            borderColor: colors.brand[400],
            borderRadius: 14,
          }}
        >
          <Corner pos="tl" />
          <Corner pos="tr" />
          <Corner pos="bl" />
          <Corner pos="br" />
        </View>

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: frameTop + frameHeight + 12,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Text className="text-white text-xs font-bold">
            카드를 사각형 안에 맞춰주세요
          </Text>
        </View>
      </View>

      {/* Bottom controls */}
      <View className="flex-1 items-center justify-center bg-black">
        <View className="flex-row items-center justify-center gap-10 mb-4">
          <Pressable
            onPress={onPickFromGallery}
            disabled={busy}
            className="w-12 h-12 bg-white/10 rounded-full items-center justify-center"
            accessibilityLabel="갤러리에서 선택"
          >
            <ImageIcon size={20} color="#fff" />
          </Pressable>

          <Pressable
            onPress={onCapture}
            disabled={busy}
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: "#fff" }}
            accessibilityLabel="촬영"
          >
            {busy ? (
              <ActivityIndicator color={colors.brand[600]} />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.brand[600],
                }}
              />
            )}
          </Pressable>

          <View className="w-12 h-12 opacity-0">
            <RotateCcw size={20} color="#fff" />
          </View>
        </View>
        <Text className="text-gray-400 text-[10px]">
          밝은 곳에서 카드 전체가 프레임 안에 들어오도록 촬영해주세요
        </Text>
      </View>
    </View>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const size = 18;
  const stroke = 3;
  const color = colors.brand[600];
  const base: any = { position: "absolute", width: size, height: size };
  if (pos === "tl")
    return (
      <View
        style={{
          ...base,
          top: -stroke,
          left: -stroke,
          borderTopWidth: stroke,
          borderLeftWidth: stroke,
          borderColor: color,
          borderTopLeftRadius: 14,
        }}
      />
    );
  if (pos === "tr")
    return (
      <View
        style={{
          ...base,
          top: -stroke,
          right: -stroke,
          borderTopWidth: stroke,
          borderRightWidth: stroke,
          borderColor: color,
          borderTopRightRadius: 14,
        }}
      />
    );
  if (pos === "bl")
    return (
      <View
        style={{
          ...base,
          bottom: -stroke,
          left: -stroke,
          borderBottomWidth: stroke,
          borderLeftWidth: stroke,
          borderColor: color,
          borderBottomLeftRadius: 14,
        }}
      />
    );
  return (
    <View
      style={{
        ...base,
        bottom: -stroke,
        right: -stroke,
        borderBottomWidth: stroke,
        borderRightWidth: stroke,
        borderColor: color,
        borderBottomRightRadius: 14,
      }}
    />
  );
}
