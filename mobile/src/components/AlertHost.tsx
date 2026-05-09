import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { colors } from "@/src/lib/colors";
import {
  _registerAlertListener,
  type AlertButton,
  type AlertButtonStyle,
  type AlertOptions,
} from "@/src/lib/alert";

const DEFAULT_BUTTONS: AlertButton[] = [{ text: "확인" }];

// "취소" / "Cancel" 처럼 명백한 취소 텍스트는 style이 없어도 cancel로 취급
function resolveStyle(b: AlertButton): AlertButtonStyle {
  if (b.style) return b.style;
  const t = b.text.trim().toLowerCase();
  if (t === "취소" || t === "cancel" || t === "닫기") return "cancel";
  return "default";
}

const BUTTON_BG: Record<AlertButtonStyle, string> = {
  default: colors.brand[600],
  destructive: "#EF4444",
  cancel: "#F3F4F6",
};
const BUTTON_FG: Record<AlertButtonStyle, string> = {
  default: colors.brand.fg,
  destructive: "#FFFFFF",
  cancel: "#374151",
};

export function AlertHost() {
  const [current, setCurrent] = useState<AlertOptions | null>(null);

  useEffect(() => {
    _registerAlertListener(setCurrent);
    return () => _registerAlertListener(null);
  }, []);

  const close = () => setCurrent(null);

  const onPressButton = (b: AlertButton) => {
    close();
    // Run after dismiss so navigation/state updates don't fight the modal.
    setTimeout(() => {
      b.onPress?.();
    }, 50);
  };

  const buttons = current?.buttons ?? DEFAULT_BUTTONS;
  // 2개일 때만 가로 배치 (cancel 먼저 → action 뒤). 그 외엔 세로 스택.
  const isRowLayout = buttons.length === 2;

  return (
    <Modal
      visible={!!current}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        onPress={close}
        style={{
          flex: 1,
          backgroundColor: "rgba(17, 24, 39, 0.55)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 20,
            width: "100%",
            maxWidth: 360,
          }}
        >
          {current?.title ? (
            <Text
              style={{
                fontSize: 17,
                fontWeight: "900",
                color: "#111827",
                marginBottom: current.message ? 8 : 20,
              }}
            >
              {current.title}
            </Text>
          ) : null}

          {current?.message ? (
            <Text
              style={{
                fontSize: 14,
                lineHeight: 20,
                color: "#4B5563",
                marginBottom: 20,
              }}
            >
              {current.message}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: isRowLayout ? "row" : "column",
              alignSelf: "stretch",
            }}
          >
            {buttons.map((b, i) => {
              const variant = resolveStyle(b);
              const isLast = i === buttons.length - 1;
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => onPressButton(b)}
                  android_ripple={{ color: "rgba(0,0,0,0.12)" }}
                  style={{
                    flexGrow: isRowLayout ? 1 : 0,
                    flexBasis: isRowLayout ? 0 : "auto",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 13,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    backgroundColor: BUTTON_BG[variant],
                    marginRight: isRowLayout && !isLast ? 10 : 0,
                    marginBottom: !isRowLayout && !isLast ? 10 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: BUTTON_FG[variant],
                    }}
                  >
                    {b.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
