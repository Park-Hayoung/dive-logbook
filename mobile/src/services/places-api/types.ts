// Places API + GPS 역지오코딩 공통 결과 타입.
// LocationField → 다이브 INSERT 까지 흘러가는 단일 형태.

export type ResolvedLocation = {
  /** 사용자에게 표시되는 국가명 (한국어). 필수 */
  country: string;
  /** 시/도 + 시/군/구 등 — 폼의 location 칸에 들어감 */
  location: string;
  /** POI 명 (문섬 등) — 폼의 point 칸. 없으면 빈 문자열 */
  point: string;
  /** WGS84 좌표 — Places/GPS 결과일 때만 채워짐 */
  lat: number | null;
  lng: number | null;
  /** Google place_id — Places 결과일 때만 채워짐 (재조회용) */
  placeId: string | null;
  /** 어디서 왔는지 추적 — 디버깅/UX 용 */
  source: "gps" | "places" | "manual";
};
