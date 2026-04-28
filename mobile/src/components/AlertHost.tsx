import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import {
  _registerAlertListener,
  type AlertButton,
  type AlertOptions,
} from "@/src/lib/alert";

const DEFAULT_BUTTONS: AlertButton[] = [{ text: "확인" }];

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
            paddingBottom: 12,
            width: "100%",
            maxWidth: 360,
          }}
        >
          {current?.title ? (
            <Text
              style={{
                fontSize: 16,
                fontWeight: "900",
                color: "#111827",
                marginBottom: current.message ? 8 : 16,
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
                color: "#374151",
                marginBottom: 16,
              }}
            >
              {current.message}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              marginTop: 4,
              marginHorizontal: -8,
            }}
          >
            {buttons.map((b, i) => (
              <Pressable
                key={`${b.text}-${i}`}
                onPress={() => onPressButton(b)}
                style={({ pressed }) => ({
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  marginHorizontal: 4,
                  backgroundColor: pressed ? "#F3F4F6" : "transparent",
                })}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "900",
                    color:
                      b.style === "destructive"
                        ? "#DC2626"
                        : b.style === "cancel"
                          ? "#6B7280"
                          : "#2563EB",
                  }}
                >
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
