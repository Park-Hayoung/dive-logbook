// Places API (New) — Text Search 단일 호출 클라이언트.
// 자동완성(Autocomplete) 은 글자마다 호출돼서 비효율 → Text Search 1콜로 대체.
//
// 비용: $5/1000 (Essentials), 월 10K 무료. 앱 레벨 캡(usage-guard) 으로 333/일 제한.
// 키: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY (Places API New 만 허용된 HTTP 키).
//
// FieldMask 는 Essentials SKU 에 포함되는 필드만 요청해서 Pro 청구 안 되게 함.

import { bumpPlacesUsage } from "./usage-guard";
import type { ResolvedLocation } from "./types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.addressComponents",
  "places.types",
].join(",");

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export type PlaceSearchResult = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  resolved: ResolvedLocation;
};

type AddressComponent = {
  longText: string;
  shortText: string;
  types: string[];
};

type RawPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: AddressComponent[];
  types?: string[];
};

const findComponent = (
  components: AddressComponent[],
  type: string,
): AddressComponent | undefined =>
  components.find((c) => c.types.includes(type));

const isAdminArea = (types: string[] | undefined): boolean => {
  if (!types) return false;
  return types.some((t) =>
    [
      "country",
      "administrative_area_level_1",
      "administrative_area_level_2",
      "locality",
      "sublocality",
      "political",
    ].includes(t),
  );
};

// 원시 Place → 우리 폼 모델로 변환.
// country: country 컴포넌트
// location: admin_level_1 + admin_level_2/locality (둘 다 있으면 합침)
// point: 결과가 POI 라면 displayName, 행정구역이면 빈 문자열
function toResolved(p: RawPlace): ResolvedLocation {
  const comps = p.addressComponents ?? [];
  const country = findComponent(comps, "country")?.longText ?? "";
  const adm1 = findComponent(comps, "administrative_area_level_1")?.longText;
  const adm2 =
    findComponent(comps, "locality")?.longText ??
    findComponent(comps, "administrative_area_level_2")?.longText;
  const location = [adm1, adm2].filter(Boolean).join(" ");

  // 행정구역 자체가 검색됐으면 point 비워둠 — 사용자가 직접 채우게
  const isAdmin = isAdminArea(p.types);
  const point = !isAdmin ? p.displayName?.text ?? "" : "";

  return {
    country,
    location: location || (p.displayName?.text ?? ""),
    point,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    placeId: p.id,
    source: "places",
  };
}

export type SearchOutcome =
  | { kind: "ok"; results: PlaceSearchResult[] }
  | { kind: "cap-exceeded"; usedToday: number; cap: number }
  | { kind: "no-key" }
  | { kind: "error"; message: string };

export async function searchPlaces(query: string): Promise<SearchOutcome> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { kind: "ok", results: [] };
  if (!API_KEY) return { kind: "no-key" };

  // 캡 체크 — 초과면 Google 호출 안 함
  let usage;
  try {
    usage = await bumpPlacesUsage();
  } catch (e) {
    return {
      kind: "error",
      message:
        e instanceof Error ? e.message : "사용량 체크에 실패했어요.",
    };
  }
  if (!usage.allowed) {
    return {
      kind: "cap-exceeded",
      usedToday: usage.usedToday,
      cap: usage.cap,
    };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: trimmed,
        languageCode: "ko",
        regionCode: "KR",
        maxResultCount: 5,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        kind: "error",
        message: `Places API ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as { places?: RawPlace[] };
    const places = json.places ?? [];
    return {
      kind: "ok",
      results: places.map((p) => ({
        placeId: p.id,
        displayName: p.displayName?.text ?? "",
        formattedAddress: p.formattedAddress ?? "",
        resolved: toResolved(p),
      })),
    };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : "네트워크 오류",
    };
  }
}

export const placesApiConfigured = !!API_KEY;
