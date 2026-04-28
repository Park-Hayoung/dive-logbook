// Drop-in replacement for React Native's Alert.alert that renders a custom
// rounded modal instead of the platform-native dialog.
//
// Usage (signature matches RN's Alert.alert):
//   import { showAlert } from "@/src/lib/alert";
//   showAlert("저장 실패", "네트워크 연결을 확인해주세요.");
//   showAlert("삭제", "정말 삭제할까요?", [
//     { text: "취소" },
//     { text: "삭제", style: "destructive", onPress: () => doDelete() },
//   ]);

export type AlertButtonStyle = "default" | "cancel" | "destructive";

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
};

export type AlertOptions = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

type Listener = (opts: AlertOptions | null) => void;

let activeListener: Listener | null = null;

// Internal: AlertHost calls this on mount to subscribe.
export function _registerAlertListener(listener: Listener | null) {
  activeListener = listener;
}

// Public API — same shape as React Native's Alert.alert.
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (activeListener) {
    activeListener({ title, message, buttons });
  } else {
    // Fallback if no host is mounted (shouldn't happen in production).
    console.warn("[showAlert] No AlertHost mounted:", title, message);
  }
}

// Internal: AlertHost calls this to dismiss.
export function _dismissAlert() {
  activeListener?.(null);
}
