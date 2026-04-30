// 다이브 로그 수정 화면 — new.tsx 와 같은 폼 구조이지만 prefill + UPDATE.
// 미디어/장비 등록 시점의 펜딩 큐는 없음 (이미 dive row 가 있으므로 갤러리에서 직접 추가).

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Sun, Cloud, CloudRain, Moon } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { KeyboardSafeScroll, DateField } from "@/src/components";
import {
  EquipmentPickerField,
  EquipmentPickerModal,
} from "@/src/components/EquipmentPicker";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";
import {
  useUserEquipment,
  useRegisterEquipment,
  type EquipmentCategory,
} from "@/src/hooks/use-equipment";
import {
  useDive,
  useUpdateDive,
  useDiveUserEquipment,
} from "@/src/hooks/use-dives";
import {
  LocationField,
  emptyLocation,
  type LocationFieldValue,
} from "@/src/components/LocationField";

type FieldKey =
  | "maxDepth"
  | "avgDepth"
  | "waterTemp"
  | "visibility"
  | "durationMinutes"
  | "memo";

type FormState = Record<FieldKey, string>;

type WeatherCode = "sunny" | "cloudy" | "rainy" | "night";

const WEATHER_OPTIONS: readonly {
  code: WeatherCode;
  label: string;
  Icon: typeof Sun;
}[] = [
  { code: "sunny", label: "맑음", Icon: Sun },
  { code: "cloudy", label: "구름", Icon: Cloud },
  { code: "rainy", label: "비", Icon: CloudRain },
  { code: "night", label: "밤", Icon: Moon },
];

const WEATHER_LABEL_TO_CODE: Record<string, WeatherCode> = {
  맑음: "sunny",
  구름: "cloudy",
  비: "rainy",
  밤: "night",
};

const parseNumber = (s: string): number | null => {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

export default function EditLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const { data: dive, isLoading: diveLoading } = useDive(id);
  const { data: linkedIds } = useDiveUserEquipment(id);
  const { data: userEquipment } = useUserEquipment(userId);
  const updateDive = useUpdateDive(userId);
  const registerEquipment = useRegisterEquipment(userId);

  const [form, setForm] = useState<FormState>({
    maxDepth: "",
    avgDepth: "",
    waterTemp: "",
    visibility: "",
    durationMinutes: "",
    memo: "",
  });
  const [location, setLocation] = useState<LocationFieldValue>(emptyLocation);
  const [diveStart, setDiveStart] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherCode>("sunny");
  const [selectedEqIds, setSelectedEqIds] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // dive + linkedIds 둘 다 로드되면 폼 초기화 (1회)
  useEffect(() => {
    if (hydrated || !dive) return;
    setForm({
      maxDepth: dive.maxDepth ? dive.maxDepth.toFixed(1) : "",
      avgDepth: dive.avgDepth ? dive.avgDepth.toFixed(1) : "",
      waterTemp: dive.waterTemp ? dive.waterTemp.toFixed(1) : "",
      visibility: dive.visibility ? String(dive.visibility) : "",
      durationMinutes: String(dive.durationMinutes),
      memo: dive.memo ?? "",
    });
    setLocation({
      country: dive.country,
      location: dive.location,
      point: dive.point ?? "",
      lat: dive.lat ?? null,
      lng: dive.lng ?? null,
      placeId: dive.placeId ?? null,
      source: "manual",
    });
    setDiveStart(new Date(dive.startedAt));
    setWeather(WEATHER_LABEL_TO_CODE[dive.weather] ?? "sunny");
    if (linkedIds) {
      setSelectedEqIds(new Set(linkedIds));
      setHydrated(true);
    }
  }, [dive, linkedIds, hydrated]);

  const update = (key: FieldKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleEquipment = (id: string) => {
    setSelectedEqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateInline = async (input: {
    brand: string;
    model: string;
    category: EquipmentCategory;
  }) => {
    try {
      const created = await registerEquipment.mutateAsync({
        kind: "custom",
        ...input,
      });
      setSelectedEqIds((prev) => new Set(prev).add(created.id));
    } catch (e) {
      showAlert("장비 추가 실패", friendlyError(e));
      throw e;
    }
  };

  const onSubmit = async () => {
    if (!dive) return;
    if (!location.country.trim() || !location.location.trim()) {
      showAlert("필수 항목", "국가와 지역은 필수예요.");
      return;
    }
    const maxDepth = parseNumber(form.maxDepth);
    if (maxDepth === null || maxDepth <= 0) {
      showAlert("최대 수심", "0보다 큰 숫자를 입력해주세요.");
      return;
    }
    const duration = parseNumber(form.durationMinutes);
    if (duration === null || duration <= 0) {
      showAlert("다이브 시간", "분 단위 숫자를 입력해주세요.");
      return;
    }

    const startedAt = diveStart ?? new Date(dive.startedAt);
    const endedAt = new Date(startedAt.getTime() + duration * 60_000);

    setSubmitting(true);
    try {
      await updateDive.mutateAsync({
        diveId: dive.id,
        patch: {
          country: location.country.trim(),
          location: location.location.trim(),
          point: location.point.trim() || null,
          lat: location.lat,
          lng: location.lng,
          placeId: location.placeId,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          maxDepth,
          avgDepth: parseNumber(form.avgDepth),
          waterTemp: parseNumber(form.waterTemp),
          visibility: parseNumber(form.visibility),
          weather,
          memo: form.memo.trim() || null,
          userEquipmentIds: [...selectedEqIds],
        },
      });
      router.back();
    } catch (err: unknown) {
      showAlert("저장 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = useMemo(
    () => !diveLoading && hydrated,
    [diveLoading, hydrated],
  );

  if (!isReady) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!dive) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-gray-400 mb-4">로그를 찾을 수 없어요.</Text>
          <Pressable
            onPress={() => router.back()}
            className="bg-gray-900 px-5 py-3 rounded-2xl"
          >
            <Text className="text-white font-black">돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-black text-gray-900">로그 수정</Text>
          <Pressable
            onPress={() => router.back()}
            className="p-2 bg-gray-100 rounded-full"
            disabled={submitting}
          >
            <X size={20} color="#374151" />
          </Pressable>
        </View>

        <Text className="text-[10px] text-gray-400">
          DIVE #{dive.diveNumber} · 사진/영상은 상세 화면에서 따로 관리해요
        </Text>

        <LocationField
          value={location}
          onChange={setLocation}
          disabled={submitting}
        />

        <DateField
          label="다이브 시작"
          value={diveStart}
          onChange={setDiveStart}
          mode="datetime"
          placeholder="날짜 + 시각"
          disabled={submitting}
          maximumDate={new Date()}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label="최대 수심 (m) *"
              value={form.maxDepth}
              onChangeText={(v) => update("maxDepth", v)}
              keyboardType="decimal-pad"
              editable={!submitting}
            />
          </View>
          <View className="flex-1">
            <Field
              label="평균 수심 (m)"
              value={form.avgDepth}
              onChangeText={(v) => update("avgDepth", v)}
              keyboardType="decimal-pad"
              editable={!submitting}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label="수온 (°C)"
              value={form.waterTemp}
              onChangeText={(v) => update("waterTemp", v)}
              keyboardType="decimal-pad"
              editable={!submitting}
            />
          </View>
          <View className="flex-1">
            <Field
              label="시야 (m)"
              value={form.visibility}
              onChangeText={(v) => update("visibility", v)}
              keyboardType="number-pad"
              editable={!submitting}
            />
          </View>
        </View>

        <Field
          label="다이브 시간 (분) *"
          value={form.durationMinutes}
          onChangeText={(v) => update("durationMinutes", v)}
          keyboardType="number-pad"
          editable={!submitting}
        />

        <View className="gap-1.5">
          <Text className="text-xs font-bold text-gray-700">날씨</Text>
          <View className="flex-row gap-2">
            {WEATHER_OPTIONS.map(({ code, label, Icon }) => {
              const active = weather === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setWeather(code)}
                  disabled={submitting}
                  className={`flex-1 items-center gap-1 py-3 rounded-2xl border ${
                    active
                      ? "bg-brand-600 border-brand-600"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Icon
                    size={18}
                    color={active ? "#FFFFFF" : "#6B7280"}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <Text
                    className={`text-[10px] font-black ${
                      active ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <EquipmentPickerField
          items={userEquipment ?? []}
          selectedIds={selectedEqIds}
          onToggle={toggleEquipment}
          onOpenPicker={() => setPickerOpen(true)}
          disabled={submitting}
        />

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">메모</Text>
          <TextInput
            value={form.memo}
            onChangeText={(v) => update("memo", v)}
            placeholder="다이브 인상, 본 어종 등"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 bg-white min-h-24"
          />
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className="bg-brand-600 p-4 rounded-2xl items-center mt-2"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-black">저장</Text>
          )}
        </Pressable>
      </KeyboardSafeScroll>

      <EquipmentPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={userEquipment ?? []}
        selectedIds={selectedEqIds}
        onPick={(id) => setSelectedEqIds((prev) => new Set(prev).add(id))}
        onCreateInline={handleCreateInline}
        creating={registerEquipment.isPending}
      />
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  editable?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  editable = true,
}: FieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-bold text-gray-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 bg-white"
      />
    </View>
  );
}
