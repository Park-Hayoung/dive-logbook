// 다이브 로그 작성용 위치 필드 — 3가지 입력 경로 통합:
//   1. 📍 내 위치 버튼 → GPS + 네이티브 역지오코딩 (무료)
//   2. 🔍 장소 검색 → Places Text Search 1콜 ($5/1000, 월 10K 무료)
//   3. 직접 입력 → 그냥 텍스트 (좌표는 비어둠)
//
// API 키 미설정/캡 도달 시 검색은 비활성화되지만 1+3 은 항상 동작 → graceful degradation.

import { useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, Search, X, Check } from "lucide-react-native";

import {
  resolveCurrentLocation,
  searchPlaces,
  placesApiConfigured,
  type ResolvedLocation,
  type PlaceSearchResult,
} from "@/src/services/places-api";
import { showAlert } from "@/src/lib/alert";

export type LocationFieldValue = ResolvedLocation;

type Props = {
  value: LocationFieldValue;
  onChange: (next: LocationFieldValue) => void;
  disabled?: boolean;
};

export function LocationField({ value, onChange, disabled }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);

  const handleGps = async () => {
    setGpsBusy(true);
    try {
      const out = await resolveCurrentLocation();
      switch (out.kind) {
        case "ok":
          onChange(out.location);
          break;
        case "permission-denied":
          showAlert(
            "위치 권한 필요",
            "설정에서 위치 접근을 허용하면 자동으로 채울 수 있어요.",
          );
          break;
        case "no-result":
          showAlert("위치 조회 실패", "주소를 찾지 못했어요. 직접 입력해주세요.");
          break;
        case "module-missing":
          showAlert(
            "GPS 모듈 미설치",
            "GPS 기능은 dev client 재빌드 후 사용 가능해요. 지금은 검색이나 직접 입력으로 진행해주세요.",
          );
          break;
        case "error":
          showAlert("위치 조회 실패", out.message);
          break;
      }
    } finally {
      setGpsBusy(false);
    }
  };

  const updateField = (key: "country" | "location" | "point", v: string) =>
    onChange({ ...value, [key]: v, source: "manual" });

  const hasCoords = value.lat !== null && value.lng !== null;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold text-gray-700">위치 *</Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={handleGps}
            disabled={disabled || gpsBusy}
            className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full"
          >
            {gpsBusy ? (
              <ActivityIndicator size="small" color={colors.brand[700]} />
            ) : (
              <MapPin size={12} color={colors.brand[700]} />
            )}
            <Text className="text-[10px] font-black text-brand-700">
              내 위치
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSearchOpen(true)}
            disabled={disabled || !placesApiConfigured}
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${
              placesApiConfigured ? "bg-brand-50" : "bg-gray-100"
            }`}
          >
            <Search
              size={12}
              color={placesApiConfigured ? colors.brand[700] : "#9CA3AF"}
            />
            <Text
              className={`text-[10px] font-black ${
                placesApiConfigured ? "text-brand-700" : "text-gray-400"
              }`}
            >
              검색
            </Text>
          </Pressable>
        </View>
      </View>

      {hasCoords ? (
        <View className="flex-row items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl">
          <Check size={12} color="#059669" />
          <Text className="text-[10px] font-black text-emerald-700 flex-1">
            좌표 저장됨 · {value.lat?.toFixed(4)}, {value.lng?.toFixed(4)}
          </Text>
          <Pressable
            onPress={() =>
              onChange({
                ...value,
                lat: null,
                lng: null,
                placeId: null,
                source: "manual",
              })
            }
            hitSlop={8}
          >
            <X size={12} color="#059669" />
          </Pressable>
        </View>
      ) : null}

      <SubField
        label="국가"
        value={value.country}
        onChangeText={(v) => updateField("country", v)}
        placeholder="대한민국"
        editable={!disabled}
      />
      <SubField
        label="지역"
        value={value.location}
        onChangeText={(v) => updateField("location", v)}
        placeholder="제주특별자치도 서귀포시"
        editable={!disabled}
      />
      <SubField
        label="포인트 (선택)"
        value={value.point}
        onChangeText={(v) => updateField("point", v)}
        placeholder="문섬 새끼섬"
        editable={!disabled}
      />

      <SearchModal
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(picked) => {
          onChange(picked.resolved);
          setSearchOpen(false);
        }}
      />
    </View>
  );
}

function SubField({
  label,
  value,
  onChangeText,
  placeholder,
  editable,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View className="gap-1">
      <Text className="text-[10px] font-bold text-gray-500">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        editable={editable}
        autoCapitalize="none"
        autoCorrect={false}
        className="border border-gray-200 rounded-2xl p-3 text-base text-gray-900 bg-white"
      />
    </View>
  );
}

// 검색 모달 — 사용자가 입력 → 검색 버튼/엔터 → Text Search 1콜 → 결과 리스트.
// 글자마다 호출하지 않음 (Autocomplete 패턴 안 씀).
function SearchModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (p: PlaceSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setBusy(false);
  };

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      setError("최소 2글자 이상 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const out = await searchPlaces(query);
    setBusy(false);
    switch (out.kind) {
      case "ok":
        setResults(out.results);
        if (out.results.length === 0) {
          setError("결과가 없어요. 다른 키워드로 검색해보세요.");
        }
        break;
      case "no-key":
        setError("검색 기능이 아직 활성화되지 않았어요. 직접 입력해주세요.");
        break;
      case "cap-exceeded":
        setError(
          `오늘 검색 한도(${out.cap}회)를 다 썼어요. 직접 입력으로 진행해주세요.`,
        );
        break;
      case "error":
        setError(out.message);
        break;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
        <View className="flex-row items-center justify-between p-4 border-b border-gray-100 bg-white">
          <Text className="text-base font-black text-gray-900">장소 검색</Text>
          <Pressable
            onPress={() => {
              reset();
              onClose();
            }}
            hitSlop={8}
            className="p-2 bg-gray-100 rounded-full"
          >
            <X size={18} color="#374151" />
          </Pressable>
        </View>

        <View className="p-4 gap-3">
          <View className="flex-row gap-2">
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              placeholder="제주 문섬, 세부 막탄, ..."
              placeholderTextColor="#9CA3AF"
              autoFocus
              returnKeyType="search"
              className="flex-1 border border-gray-200 rounded-2xl p-3 text-base bg-white"
            />
            <Pressable
              onPress={handleSearch}
              disabled={busy}
              className="bg-brand-600 px-4 rounded-2xl items-center justify-center"
            >
              {busy ? (
                <ActivityIndicator color={colors.brand.fg} />
              ) : (
                <Search size={18} color={colors.brand.fg} />
              )}
            </Pressable>
          </View>

          {error ? (
            <Text className="text-xs text-red-600 px-1">{error}</Text>
          ) : (
            <Text className="text-[10px] text-gray-400 px-1">
              
            </Text>
          )}
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
          {results.map((r) => (
            <Pressable
              key={r.placeId}
              onPress={() => {
                onPick(r);
                reset();
              }}
              className="bg-white p-4 rounded-2xl border border-gray-100 mb-2 active:opacity-70"
            >
              <Text className="font-black text-sm text-gray-900">
                {r.displayName || r.formattedAddress}
              </Text>
              <Text className="text-[10px] text-gray-500 mt-1">
                {r.formattedAddress}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// 폼 초기값 헬퍼.
export const emptyLocation: LocationFieldValue = {
  country: "",
  location: "",
  point: "",
  lat: null,
  lng: null,
  placeId: null,
  source: "manual",
};
