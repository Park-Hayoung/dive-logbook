// 다이브 로그 수정 화면 — new.tsx 와 같은 폼 구조이지만 prefill + UPDATE.
// BLE 가져오기로 생성된 로그 (is_verified=true) 의 BLE 측정 필드는 잠긴다 —
// 깊이/시간/시작 시각/수온/탱크 압력은 변조 방지를 위해 readonly.

import { useEffect, useMemo, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  X,
  Sun,
  Cloud,
  CloudRain,
  Moon,
  Wind,
  ShieldCheck,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { KeyboardSafeScroll, DateField } from "@/src/components";
import {
  EquipmentPickerField,
  EquipmentPickerModal,
} from "@/src/components/EquipmentPicker";
import {
  BuddyPickerField,
  BuddyPickerModal,
} from "@/src/components/BuddyPicker";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";
import {
  useUserEquipment,
  useRegisterEquipment,
  type EquipmentCategory,
} from "@/src/hooks/use-equipment";
import {
  useUserBuddies,
  useDiveBuddies,
  useAddBuddy,
  type BuddyProfile,
} from "@/src/hooks/use-buddies";
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
import type { CurrentStrength } from "@/src/types/dive";

type FieldKey =
  | "maxDepth"
  | "avgDepth"
  | "waterTemp"
  | "visibility"
  | "memo"
  | "tankVolumeL"
  | "tankStartBar"
  | "tankEndBar"
  | "surfaceIntervalMin";

type FormState = Record<FieldKey, string>;

const combineDateAndTime = (date: Date, time: Date): Date => {
  const out = new Date(date);
  out.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return out;
};

const computeDurationMinutes = (
  date: Date | null,
  entry: Date | null,
  exit: Date | null,
): number | null => {
  if (!date || !entry || !exit) return null;
  const start = combineDateAndTime(date, entry);
  let end = combineDateAndTime(date, exit);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60_000);
  }
  return Math.round((end.getTime() - start.getTime()) / 60_000);
};

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

const CURRENT_OPTIONS: ReadonlyArray<{ code: CurrentStrength; label: string }> = [
  { code: "none", label: "없음" },
  { code: "mild", label: "약함" },
  { code: "moderate", label: "보통" },
  { code: "strong", label: "강함" },
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
  const { data: linkedBuddyIds } = useDiveBuddies(id);
  const { data: userEquipment } = useUserEquipment(userId);
  const { data: userBuddies } = useUserBuddies(userId);
  const updateDive = useUpdateDive(userId);
  const registerEquipment = useRegisterEquipment(userId);
  const addBuddy = useAddBuddy(userId);

  const [form, setForm] = useState<FormState>({
    maxDepth: "",
    avgDepth: "",
    waterTemp: "",
    visibility: "",
    memo: "",
    tankVolumeL: "",
    tankStartBar: "",
    tankEndBar: "",
    surfaceIntervalMin: "",
  });
  const [location, setLocation] = useState<LocationFieldValue>(emptyLocation);
  const [diveDate, setDiveDate] = useState<Date | null>(null);
  const [entryTime, setEntryTime] = useState<Date | null>(null);
  const [exitTime, setExitTime] = useState<Date | null>(null);

  const durationMinutes = useMemo(
    () => computeDurationMinutes(diveDate, entryTime, exitTime),
    [diveDate, entryTime, exitTime],
  );
  const [weather, setWeather] = useState<WeatherCode>("sunny");
  const [currentStrength, setCurrentStrength] =
    useState<CurrentStrength | null>(null);
  const [selectedEqIds, setSelectedEqIds] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedBuddyIds, setSelectedBuddyIds] = useState<Set<string>>(
    new Set(),
  );
  // 검색에서 새로 고른, 아직 user_buddies 에 없는 프로필. 저장 시점에 등록됨.
  const [pendingNewBuddies, setPendingNewBuddies] = useState<
    Map<string, BuddyProfile>
  >(new Map());
  const [buddyPickerOpen, setBuddyPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const toggleBuddy = (id: string) => {
    setSelectedBuddyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPendingNewBuddies((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  // BLE 측정 필드는 is_verified=true 일 때 잠긴다.
  const isLocked = !!dive?.isVerified;
  // 탱크 압력은 예외 — BLE가 비워둔 경우(AI transmitter 없는 다이브)는 사용자가 채울 수 있게 한다.
  const tankStartLocked = isLocked && dive?.tankStartBar !== null;
  const tankEndLocked = isLocked && dive?.tankEndBar !== null;

  // dive + linkedIds 둘 다 로드되면 폼 초기화 (1회)
  useEffect(() => {
    if (hydrated || !dive) return;
    setForm({
      maxDepth: dive.maxDepth ? dive.maxDepth.toFixed(1) : "",
      avgDepth: dive.avgDepth ? dive.avgDepth.toFixed(1) : "",
      waterTemp: dive.waterTemp ? dive.waterTemp.toFixed(1) : "",
      visibility: dive.visibility ? String(dive.visibility) : "",
      memo: dive.memo ?? "",
      tankVolumeL: dive.tankVolumeL ? dive.tankVolumeL.toFixed(1) : "",
      tankStartBar: dive.tankStartBar ? dive.tankStartBar.toFixed(0) : "",
      tankEndBar: dive.tankEndBar ? dive.tankEndBar.toFixed(0) : "",
      surfaceIntervalMin:
        dive.surfaceIntervalMin !== null
          ? String(dive.surfaceIntervalMin)
          : "",
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
    const start = new Date(dive.startedAt);
    const end = new Date(dive.endedAt);
    setDiveDate(start);
    setEntryTime(start);
    setExitTime(end);
    setWeather(WEATHER_LABEL_TO_CODE[dive.weather] ?? "sunny");
    setCurrentStrength(dive.currentStrength ?? null);
    if (linkedIds && linkedBuddyIds) {
      setSelectedEqIds(new Set(linkedIds));
      setSelectedBuddyIds(new Set(linkedBuddyIds));
      setHydrated(true);
    }
  }, [dive, linkedIds, linkedBuddyIds, hydrated]);

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

    // BLE 잠금이 아닐 때만 깊이/시간/시작 등을 검증/전송한다.
    let maxDepth: number | undefined;
    let duration: number | undefined;
    if (!isLocked) {
      const md = parseNumber(form.maxDepth);
      if (md === null || md <= 0) {
        showAlert("최대 수심", "0보다 큰 숫자를 입력해주세요.");
        return;
      }
      maxDepth = md;
      if (!diveDate || !entryTime || !exitTime) {
        showAlert(
          "다이브 시간",
          "날짜, 입수 시간, 출수 시간을 모두 선택해주세요.",
        );
        return;
      }
      if (durationMinutes === null || durationMinutes <= 0) {
        showAlert("다이브 시간", "출수 시간이 입수 시간보다 늦어야 해요.");
        return;
      }
      duration = durationMinutes;
    }

    setSubmitting(true);
    try {
      const startedAt =
        diveDate && entryTime
          ? combineDateAndTime(diveDate, entryTime)
          : new Date(dive.startedAt);
      let endedAt: Date;
      if (diveDate && entryTime && exitTime && !isLocked) {
        endedAt = combineDateAndTime(diveDate, exitTime);
        if (endedAt.getTime() <= startedAt.getTime()) {
          endedAt = new Date(endedAt.getTime() + 24 * 60 * 60_000);
        }
      } else {
        endedAt = new Date(dive.endedAt);
      }

      // 검색에서 새로 추가한 사람 → 내 버디 리스트(user_buddies)에도 등록.
      // dive_buddies 업데이트 전에 처리해 동시 INSERT 충돌 회피.
      const pendingToRegister = [...pendingNewBuddies.keys()].filter((id) =>
        selectedBuddyIds.has(id),
      );
      for (const buddyId of pendingToRegister) {
        try {
          await addBuddy.mutateAsync(buddyId);
        } catch (e) {
          console.warn("user_buddies insert failed for", buddyId, e);
        }
      }

      await updateDive.mutateAsync({
        diveId: dive.id,
        patch: {
          country: location.country.trim(),
          location: location.location.trim(),
          point: location.point.trim() || null,
          lat: location.lat,
          lng: location.lng,
          placeId: location.placeId,
          visibility: parseNumber(form.visibility),
          weather,
          memo: form.memo.trim() || null,
          currentStrength,
          surfaceIntervalMin: parseNumber(form.surfaceIntervalMin),
          tankVolumeL: parseNumber(form.tankVolumeL),
          userEquipmentIds: [...selectedEqIds],
          buddyUserIds: [...selectedBuddyIds],
          // BLE-locked: only include depth/time/temp when not verified.
          ...(isLocked
            ? {}
            : {
                startedAt: startedAt.toISOString(),
                endedAt: endedAt.toISOString(),
                maxDepth,
                avgDepth: parseNumber(form.avgDepth),
                waterTemp: parseNumber(form.waterTemp),
              }),
          // 탱크 압력: BLE가 채워준 경우만 잠금. 비어있던 칸은 사용자가 채울 수 있다.
          ...(tankStartLocked ? {} : { tankStartBar: parseNumber(form.tankStartBar) }),
          ...(tankEndLocked ? {} : { tankEndBar: parseNumber(form.tankEndBar) }),
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

  const lockedEditable = !submitting && !isLocked;
  const editable = !submitting;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-bold text-gray-900">로그 수정</Text>
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

        {isLocked ? (
          <View className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex-row gap-3">
            <ShieldCheck size={18} color="#059669" />
            <View className="flex-1">
              <Text className="text-xs font-black text-emerald-800 mb-1">
                다이브 컴퓨터에서 가져온 로그
              </Text>
              <Text className="text-[11px] text-emerald-800/80 leading-4">
                깊이 · 시간 · 시작 시각 · 수온 · 탱크 압력은 변조 방지를 위해
                잠겨 있어요. 위치 · 메모 · 조건 · 장비 같은 사용자 항목은 자유롭게
                수정할 수 있습니다.
              </Text>
            </View>
          </View>
        ) : null}

        <LocationField
          value={location}
          onChange={setLocation}
          disabled={submitting}
        />

        <DateField
          label={"다이브 날짜" + (isLocked ? "" : " *")}
          value={diveDate}
          onChange={setDiveDate}
          mode="date"
          placeholder="YYYY-MM-DD"
          disabled={!lockedEditable}
          maximumDate={new Date()}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <DateField
              label={"입수 시간" + (isLocked ? "" : " *")}
              value={entryTime}
              onChange={setEntryTime}
              mode="time"
              placeholder="HH:MM"
              disabled={!lockedEditable}
            />
          </View>
          <View className="flex-1">
            <DateField
              label={"출수 시간" + (isLocked ? "" : " *")}
              value={exitTime}
              onChange={setExitTime}
              mode="time"
              placeholder="HH:MM"
              disabled={!lockedEditable}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label={"최대 수심 (m)" + (isLocked ? "" : " *")}
              value={form.maxDepth}
              onChangeText={(v) => update("maxDepth", v)}
              keyboardType="decimal-pad"
              editable={lockedEditable}
              locked={isLocked}
            />
          </View>
          <View className="flex-1">
            <Field
              label="평균 수심 (m)"
              value={form.avgDepth}
              onChangeText={(v) => update("avgDepth", v)}
              keyboardType="decimal-pad"
              editable={lockedEditable}
              locked={isLocked}
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
              editable={lockedEditable}
              locked={isLocked}
            />
          </View>
          <View className="flex-1">
            <Field
              label="시야 (m)"
              value={form.visibility}
              onChangeText={(v) => update("visibility", v)}
              keyboardType="number-pad"
              editable={editable}
            />
          </View>
        </View>

        <Field
          label={
            isLocked ? "다이브 시간 (분)" : "다이브 시간 (분) (자동 계산)"
          }
          value={
            isLocked
              ? String(dive.durationMinutes)
              : durationMinutes !== null
              ? String(durationMinutes)
              : ""
          }
          onChangeText={() => {
            /* 입수/출수 시간으로 자동 계산되는 값이라 수정 불가 */
          }}
          keyboardType="number-pad"
          editable={false}
          locked={isLocked}
        />

        <View className="gap-2">
          <Text className="text-xs font-bold text-gray-700">탱크 / 공기</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="용량 (L)"
                value={form.tankVolumeL}
                onChangeText={(v) => update("tankVolumeL", v)}
                keyboardType="decimal-pad"
                editable={editable}
              />
            </View>
            <View className="flex-1">
              <Field
                label="시작 (bar)"
                value={form.tankStartBar}
                onChangeText={(v) => update("tankStartBar", v)}
                keyboardType="decimal-pad"
                editable={!submitting && !tankStartLocked}
                locked={tankStartLocked}
              />
            </View>
            <View className="flex-1">
              <Field
                label="종료 (bar)"
                value={form.tankEndBar}
                onChangeText={(v) => update("tankEndBar", v)}
                keyboardType="decimal-pad"
                editable={!submitting && !tankEndLocked}
                locked={tankEndLocked}
              />
            </View>
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-bold text-gray-700">조류</Text>
          <View className="flex-row gap-2">
            {CURRENT_OPTIONS.map(({ code, label }) => {
              const active = currentStrength === code;
              return (
                <Pressable
                  key={code}
                  onPress={() =>
                    setCurrentStrength((prev) =>
                      prev === code ? null : code,
                    )
                  }
                  disabled={!editable}
                  className={`flex-1 items-center py-2 rounded-xl border ${
                    active
                      ? "bg-brand-600 border-brand-600"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Wind
                    size={12}
                    color={active ? "#FFFFFF" : "#9CA3AF"}
                  />
                  <Text
                    className={`text-[9px] font-black mt-0.5 ${
                      active ? "text-brand-fg" : "text-gray-700"
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field
          label="수면 휴식 (분, 직전 다이브와의 간격)"
          value={form.surfaceIntervalMin}
          onChangeText={(v) => update("surfaceIntervalMin", v)}
          keyboardType="number-pad"
          editable={editable}
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
                  disabled={!editable}
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
                      active ? "text-brand-fg" : "text-gray-700"
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
          disabled={!editable}
        />

        <BuddyPickerField
          items={userBuddies ?? []}
          pendingProfiles={Array.from(pendingNewBuddies.values())}
          selectedIds={selectedBuddyIds}
          onToggle={toggleBuddy}
          onOpenPicker={() => setBuddyPickerOpen(true)}
          disabled={!editable}
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
            editable={editable}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 bg-white min-h-24"
          />
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className="bg-brand-600 p-4 rounded-2xl items-center mt-2"
        >
          {submitting ? (
            <ActivityIndicator color={colors.brand.fg} />
          ) : (
            <Text className="text-brand-fg font-black">저장</Text>
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
        onPickFromCatalog={async ({ equipmentId, category }) => {
          const created = await registerEquipment.mutateAsync({
            kind: "catalog",
            equipmentId,
            category,
          });
          setSelectedEqIds((prev) => new Set(prev).add(created.id));
        }}
      />

      <BuddyPickerModal
        visible={buddyPickerOpen}
        onClose={() => setBuddyPickerOpen(false)}
        items={userBuddies ?? []}
        selectedIds={selectedBuddyIds}
        onPick={(id) =>
          setSelectedBuddyIds((prev) => new Set(prev).add(id))
        }
        onGoToManage={() => router.push("/buddies" as never)}
        currentUserId={userId}
        onPickNew={(profile) => {
          setSelectedBuddyIds((prev) => new Set(prev).add(profile.id));
          setPendingNewBuddies((prev) => {
            const next = new Map(prev);
            next.set(profile.id, profile);
            return next;
          });
        }}
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
  locked?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  editable = true,
  locked = false,
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
        className={`border rounded-2xl p-4 text-base ${
          locked
            ? "border-emerald-100 bg-emerald-50/40 text-emerald-900"
            : "border-gray-200 bg-white text-gray-900"
        }`}
      />
    </View>
  );
}
