// GPS 기반 현재 위치 → 행정구역 역지오코딩.
// expo-location 은 Apple/Android 네이티브 지오코더를 씀 → Google API 안 거치고 무료.
//
// 동적 import 사용 — dev client 에 expo-location native 모듈이 빌드 안 되어 있을 때
// 앱 전체 크래시 대신 GPS 버튼 탭 시점에만 에러를 발생시켜 다른 기능(검색/직접입력)은
// 정상 동작하게 함.

import type { ResolvedLocation } from "./types";

export type GpsOutcome =
  | { kind: "ok"; location: ResolvedLocation }
  | { kind: "permission-denied" }
  | { kind: "no-result" }
  | { kind: "module-missing" }
  | { kind: "error"; message: string };

export async function resolveCurrentLocation(): Promise<GpsOutcome> {
  let Location: typeof import("expo-location");
  try {
    Location = await import("expo-location");
  } catch {
    return { kind: "module-missing" };
  }

  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { kind: "permission-denied" };

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const r = places[0];
    if (!r) return { kind: "no-result" };

    // expo-location 의 reverseGeocode 결과는 OS/locale 마다 다름.
    // country / region / city / district / name 을 최대한 활용.
    const country = r.country ?? "";
    const adminBits = [r.region, r.city, r.district].filter(
      (s): s is string => !!s && s.length > 0,
    );
    const location = adminBits.join(" ");
    const point = r.name && r.name !== r.street ? r.name : "";

    return {
      kind: "ok",
      location: {
        country,
        location,
        point,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        placeId: null,
        source: "gps",
      },
    };
  } catch (e) {
    // 모듈은 import 됐지만 런타임에 native 함수 호출 실패하는 경우
    // (예: 권한 미선언, 시뮬레이터 위치 미설정 등)
    const msg = e instanceof Error ? e.message : "위치 조회 실패";
    if (msg.includes("Cannot find native module")) {
      return { kind: "module-missing" };
    }
    return { kind: "error", message: msg };
  }
}
