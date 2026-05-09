import { useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/src/lib/colors";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type LatLng,
  type Region,
} from "react-native-maps";

import type { Dive } from "@/src/types/dive";

export type DiveMarker = {
  key: string;
  latitude: number;
  longitude: number;
  count: number;
  label: string;
  diveIds: string[];
};

// 같은 포인트(소수점 셋째 자리, 약 100m)에서 찍힌 다이브들을 한 마커로 묶는다.
const PRECISION = 1000;

export function buildDiveMarkers(dives: Dive[] | undefined): DiveMarker[] {
  if (!dives) return [];
  const groups = new Map<string, DiveMarker>();
  for (const d of dives) {
    if (d.lat == null || d.lng == null) continue;
    const lat = Math.round(d.lat * PRECISION) / PRECISION;
    const lng = Math.round(d.lng * PRECISION) / PRECISION;
    const key = `${lat},${lng}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.diveIds.push(d.id);
    } else {
      const label = d.point || d.location || d.country || "다이브 포인트";
      groups.set(key, {
        key,
        latitude: lat,
        longitude: lng,
        count: 1,
        label,
        diveIds: [d.id],
      });
    }
  }
  return [...groups.values()];
}

const computeRegion = (markers: DiveMarker[]): Region | undefined => {
  if (markers.length === 0) return undefined;
  if (markers.length === 1) {
    return {
      latitude: markers[0].latitude,
      longitude: markers[0].longitude,
      latitudeDelta: 1.5,
      longitudeDelta: 1.5,
    };
  }
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const m of markers) {
    if (m.latitude < minLat) minLat = m.latitude;
    if (m.latitude > maxLat) maxLat = m.latitude;
    if (m.longitude < minLng) minLng = m.longitude;
    if (m.longitude > maxLng) maxLng = m.longitude;
  }
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max((maxLat - minLat) * 1.4, 0.5);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.4, 0.5);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
};

type DiveMapProps = {
  dives: Dive[] | undefined;
  height?: number;
  fill?: boolean;
  interactive?: boolean;
  onMarkerPress?: (marker: DiveMarker) => void;
  // 미니맵에서 카드 전체 탭으로 풀스크린 이동 등을 처리할 때 사용. interactive=false 일 때만
  // 절대 위치 overlay 로 터치를 가로채 호출한다.
  onPress?: () => void;
};

export function DiveMap({
  dives,
  height = 200,
  fill = false,
  interactive = true,
  onMarkerPress,
  onPress,
}: DiveMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const markers = useMemo(() => buildDiveMarkers(dives), [dives]);
  const initialRegion = useMemo(() => computeRegion(markers), [markers]);

  useEffect(() => {
    if (markers.length < 2 || !mapRef.current) return;
    const coords: LatLng[] = markers.map((m) => ({
      latitude: m.latitude,
      longitude: m.longitude,
    }));
    // setTimeout으로 살짝 지연 — 안드로이드에서 첫 프레임 mount 직후 호출하면 무시됨.
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: false,
      });
    }, 100);
    return () => clearTimeout(t);
  }, [markers]);

  if (markers.length === 0) return null;

  const wrapperStyle = fill
    ? { flex: 1, width: "100%" as const, overflow: "hidden" as const }
    : {
        height,
        width: "100%" as const,
        borderRadius: 24,
        overflow: "hidden" as const,
      };

  return (
    <View style={wrapperStyle}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        toolbarEnabled={false}
        showsCompass={false}
        showsMyLocationButton={false}
      >
        {markers.map((m) => (
          <Marker
            key={m.key}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.label}
            description={m.count > 1 ? `${m.count}회 다이빙` : undefined}
            onPress={
              onMarkerPress ? () => onMarkerPress(m) : undefined
            }
            pinColor={colors.brand[600]}
          />
        ))}
      </MapView>
      {!interactive && onPress ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onPress}
          android_ripple={{ color: "rgba(0,0,0,0.05)" }}
        />
      ) : null}
    </View>
  );
}
