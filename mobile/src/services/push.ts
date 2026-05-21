import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { supabase } from "@/src/services/supabase";

// 외부 진입점:
//   * registerPushTokenForUser(userId) — 로그인 후 호출. 권한 요청 → Expo Push Token 발급 →
//     profile_push_tokens UPSERT → last_seen_at 갱신.
//   * unregisterPushTokenForCurrentDevice() — 로그아웃 시 호출. 토큰 DELETE.
//
// 알림 핸들러(`Notifications.setNotificationHandler`)와 deep-link 리스너는 app/_layout.tsx
// 에서 마운트.

// 디바이스가 푸시를 받을 수 있는지 — 시뮬레이터/Expo Go(SDK 53+) 제외.
function canReceivePush(): boolean {
  if (!Device.isDevice) return false;
  // Expo Go on SDK 53+ no longer supports push tokens (must use dev build / production).
  if (Constants.appOwnership === "expo") return false;
  return true;
}

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === "granted";
}

async function fetchExpoPushToken(): Promise<string | null> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("[push] EAS projectId 없음 — app.json extra.eas.projectId 확인");
    return null;
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    console.warn("[push] getExpoPushTokenAsync 실패", e);
    return null;
  }
}

// Android 는 notification channel 설정 필요 (배너/소리 동작 보장).
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "기본",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0066FF",
  });
}

export async function registerPushTokenForUser(
  userId: string,
): Promise<{ registered: boolean; reason?: string }> {
  if (!canReceivePush()) {
    return { registered: false, reason: "device-or-expo-go" };
  }
  await ensureAndroidChannel();
  const granted = await ensurePermission();
  if (!granted) return { registered: false, reason: "permission-denied" };

  const token = await fetchExpoPushToken();
  if (!token) return { registered: false, reason: "token-unavailable" };

  // 같은 디바이스(=같은 token) 가 다른 계정으로 로그인했을 수 있어 user_id 갱신 필요.
  // RPC (SECURITY DEFINER) 로 호출 — 일반 RLS UPDATE 정책으로는 다른 사용자 소유의
  // 기존 행을 갱신할 수 없어서 026 마이그레이션의 register_push_token() 사용.
  const { error } = await supabase.rpc("register_push_token", {
    p_token: token,
    p_platform: Platform.OS === "ios" ? "ios" : "android",
    p_device_label: Device.deviceName ?? null,
  });
  if (error) {
    console.warn("[push] register_push_token 실패", error.message);
    return { registered: false, reason: "upsert-failed" };
  }
  return { registered: true };
}

export async function unregisterPushTokenForCurrentDevice(): Promise<void> {
  if (!canReceivePush()) return;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (!token) return;
    await supabase.from("profile_push_tokens").delete().eq("token", token);
  } catch (e) {
    console.warn("[push] unregister 실패", e);
  }
}
