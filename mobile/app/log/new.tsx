import { useMemo, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  X,
  Sun,
  Cloud,
  CloudRain,
  Moon,
  ImagePlus,
  Video as VideoIcon,
  Play,
  Wind,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/src/store/auth-store";
import { supabase } from "@/src/services/supabase";
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
  useAddBuddy,
  type BuddyProfile,
} from "@/src/hooks/use-buddies";
import { mediaStorage } from "@/src/services/media-storage";
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
  | "memo"
  | "tankVolumeL"
  | "tankStartBar"
  | "tankEndBar"
  | "surfaceIntervalMin";

type FormState = Record<FieldKey, string>;

// 날짜(YYYY-MM-DD) + 시각(HH:MM)을 합쳐서 하나의 Date 로. 연/월/일은 첫 인자에서,
// 시/분은 두 번째 인자에서 가져온다.
const combineDateAndTime = (date: Date, time: Date): Date => {
  const out = new Date(date);
  out.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return out;
};

// 입수~출수 분 단위 다이브 시간. 출수가 입수보다 빠르면 자정을 넘긴 것으로 보고 24h 보정.
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

type CurrentStrength = "none" | "mild" | "moderate" | "strong";

const CURRENT_OPTIONS: ReadonlyArray<{ code: CurrentStrength; label: string }> = [
  { code: "none", label: "없음" },
  { code: "mild", label: "약함" },
  { code: "moderate", label: "보통" },
  { code: "strong", label: "강함" },
];

const WEATHER_OPTIONS: ReadonlyArray<{
  code: WeatherCode;
  label: string;
  Icon: typeof Sun;
}> = [
  { code: "sunny", label: "맑음", Icon: Sun },
  { code: "cloudy", label: "구름", Icon: Cloud },
  { code: "rainy", label: "비", Icon: CloudRain },
  { code: "night", label: "밤", Icon: Moon },
];

const INITIAL: FormState = {
  maxDepth: "",
  avgDepth: "",
  waterTemp: "",
  visibility: "",
  memo: "",
  tankVolumeL: "",
  tankStartBar: "",
  tankEndBar: "",
  surfaceIntervalMin: "",
};

const parseNumber = (s: string): number | null => {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

type PendingMedia = {
  localUri: string;
  kind: "image" | "video";
  contentType: string;
  filename: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
};

const guessContentType = (uri: string, kind: "image" | "video"): string => {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  if (kind === "video") {
    if (ext === "mov") return "video/quicktime";
    if (ext === "m4v") return "video/x-m4v";
    return "video/mp4";
  }
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
};

const filenameFrom = (uri: string, kind: "image" | "video"): string => {
  const last = uri.split("/").pop();
  if (last && last.includes(".")) return last;
  return `${Date.now()}.${kind === "video" ? "mp4" : "jpg"}`;
};

async function tryCompressVideo(
  uri: string,
): Promise<{ uri: string; thumbnailUri: string | null }> {
  try {
    const mod = await import("@/src/services/video-compression");
    const result = await mod.compressVideoForUpload(uri);
    return { uri: result.uri, thumbnailUri: result.thumbnailUri };
  } catch {
    return { uri, thumbnailUri: null };
  }
}

export default function NewLogScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [location, setLocation] = useState<LocationFieldValue>(emptyLocation);
  const [diveDate, setDiveDate] = useState<Date | null>(null);
  const [entryTime, setEntryTime] = useState<Date | null>(null);
  const [exitTime, setExitTime] = useState<Date | null>(null);

  // 입수/출수 시간이 모두 채워졌을 때만 자동 계산. 그 전에는 안내 텍스트가 보임.
  const durationMinutes = useMemo(
    () => computeDurationMinutes(diveDate, entryTime, exitTime),
    [diveDate, entryTime, exitTime],
  );
  const [weather, setWeather] = useState<WeatherCode>("sunny");
  const [currentStrength, setCurrentStrength] =
    useState<CurrentStrength | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ──── 장비 선택 ────
  const { data: userEquipment } = useUserEquipment(userId);
  const registerEquipment = useRegisterEquipment(userId);
  const [selectedEqIds, setSelectedEqIds] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  // ──── 버디 선택 ────
  const { data: userBuddies } = useUserBuddies(userId);
  const addBuddy = useAddBuddy(userId);
  const [selectedBuddyIds, setSelectedBuddyIds] = useState<Set<string>>(
    new Set(),
  );
  // 검색에서 새로 고른, 아직 user_buddies 에 없는 프로필. 저장 시점에 등록됨.
  const [pendingNewBuddies, setPendingNewBuddies] = useState<
    Map<string, BuddyProfile>
  >(new Map());
  const [buddyPickerOpen, setBuddyPickerOpen] = useState(false);

  const toggleBuddy = (id: string) => {
    setSelectedBuddyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // 선택 해제 시 pending 에서도 제거 — 저장 시점에 의도치 않은 INSERT 방지.
    setPendingNewBuddies((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  // ──── 사진/영상 펜딩 큐 ────
  // 다이브 row 가 아직 없으니 업로드는 보류 — INSERT 성공 후 일괄 업로드.
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const pickMedia = async (kind: "image" | "video") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert("권한 필요", "사진 라이브러리 접근 권한을 허용해주세요.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "video" ? ["videos"] : ["images"],
      quality: 0.9,
      allowsMultipleSelection: kind === "image",
      selectionLimit: kind === "image" ? 10 : 1,
      videoMaxDuration: 300,
    });
    if (picked.canceled) return;
    const additions: PendingMedia[] = picked.assets.map((asset) => {
      const assetKind: "image" | "video" =
        asset.type === "video" ? "video" : "image";
      return {
        localUri: asset.uri,
        kind: assetKind,
        contentType: asset.mimeType ?? guessContentType(asset.uri, assetKind),
        filename: asset.fileName ?? filenameFrom(asset.uri, assetKind),
        durationSeconds:
          assetKind === "video" && typeof asset.duration === "number"
            ? Math.round(asset.duration / 1000)
            : null,
        width: asset.width ?? null,
        height: asset.height ?? null,
      };
    });
    setPendingMedia((prev) => [...prev, ...additions]);
  };

  const removePending = (idx: number) =>
    setPendingMedia((prev) => prev.filter((_, i) => i !== idx));

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
      // 새로 등록한 장비를 자동 체크 → 이번 다이브에 즉시 연결됨
      setSelectedEqIds((prev) => new Set(prev).add(created.id));
    } catch (e) {
      showAlert("장비 추가 실패", friendlyError(e));
      throw e; // 모달이 닫히지 않도록
    }
  };

  const onSubmit = async () => {
    if (!userId) {
      showAlert("오류", "로그인 세션이 없어요.");
      return;
    }
    if (!location.country.trim() || !location.location.trim()) {
      showAlert("필수 항목", "국가와 지역은 필수예요.");
      return;
    }
    const maxDepth = parseNumber(form.maxDepth);
    if (maxDepth === null || maxDepth <= 0) {
      showAlert("최대 수심", "0보다 큰 숫자를 입력해주세요.");
      return;
    }
    if (!diveDate || !entryTime || !exitTime) {
      showAlert("다이브 시간", "날짜, 입수 시간, 출수 시간을 모두 선택해주세요.");
      return;
    }
    const duration = durationMinutes;
    if (duration === null || duration <= 0) {
      showAlert("다이브 시간", "출수 시간이 입수 시간보다 늦어야 해요.");
      return;
    }

    setSubmitting(true);
    try {
      const { count, error: countError } = await supabase
        .from("dives")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      if (countError) throw countError;

      const nextNumber = (count ?? 0) + 1;
      const startedAt = combineDateAndTime(diveDate, entryTime);
      let endedAt = combineDateAndTime(diveDate, exitTime);
      // 출수가 입수보다 이른 시각이면 자정을 넘긴 것 — 다음날로 보정.
      if (endedAt.getTime() <= startedAt.getTime()) {
        endedAt = new Date(endedAt.getTime() + 24 * 60 * 60_000);
      }

      const tankStart = parseNumber(form.tankStartBar);
      const tankEnd = parseNumber(form.tankEndBar);
      const consumptionBarPerMin =
        tankStart !== null && tankEnd !== null && duration > 0
          ? Math.round(((tankStart - tankEnd) / duration) * 10) / 10
          : null;

      const { data: insertedDive, error } = await supabase
        .from("dives")
        .insert({
          user_id: userId,
          dive_number: nextNumber,
          country: location.country.trim(),
          location: location.location.trim(),
          point: location.point.trim() || null,
          lat: location.lat,
          lng: location.lng,
          place_id: location.placeId,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          max_depth: maxDepth,
          avg_depth: parseNumber(form.avgDepth),
          water_temp: parseNumber(form.waterTemp),
          visibility: parseNumber(form.visibility),
          weather,
          memo: form.memo.trim() || null,
          is_verified: false,
          current_strength: currentStrength,
          surface_interval_min: parseNumber(form.surfaceIntervalMin),
          tank_volume_l: parseNumber(form.tankVolumeL),
          tank_start_bar: tankStart,
          tank_end_bar: tankEnd,
          consumption_bar_per_min: consumptionBarPerMin,
        })
        .select("id")
        .single();
      if (error) throw error;

      // 선택된 보유 장비 → 이번 다이브에 연결.
      // 장비 링크 실패는 다이브 저장 자체를 망가뜨리지 않게 별도 처리. 다이브 row 는 이미
      // 저장됐기 때문에 여기서 throw 하면 사용자가 "저장 실패"로 오해해 재시도 → 중복 발생.
      const diveId = (insertedDive as { id: string }).id;
      let equipmentLinkError: string | null = null;
      if (selectedEqIds.size > 0) {
        const links = [...selectedEqIds].map((eqId) => ({
          dive_id: diveId,
          user_equipment_id: eqId,
        }));
        const { error: linkError } = await supabase
          .from("dive_user_equipment")
          .insert(links);
        if (linkError) {
          console.error("dive_user_equipment insert failed", linkError);
          equipmentLinkError = linkError.message ?? "장비 연결에 실패했어요.";
        }
      }

      // 선택된 버디 → 이번 다이브에 연결. 실패해도 다이브 저장 자체는 유지.
      let buddyLinkError: string | null = null;
      if (selectedBuddyIds.size > 0) {
        const links = [...selectedBuddyIds].map((bId) => ({
          dive_id: diveId,
          user_id: bId,
        }));
        const { error: linkError } = await supabase
          .from("dive_buddies")
          .insert(links);
        if (linkError) {
          console.error("dive_buddies insert failed", linkError);
          buddyLinkError = linkError.message ?? "버디 연결에 실패했어요.";
        }
      }

      // 검색에서 새로 추가한 사람 → 내 버디 리스트(user_buddies)에도 등록.
      // 다이브 저장과 별개로 실패해도 다이브 자체는 유지.
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

      // 사진/영상 업로드 — 다이브 row 가 생긴 뒤에야 가능
      let uploadFailures = 0;
      if (pendingMedia.length > 0) {
        for (let i = 0; i < pendingMedia.length; i++) {
          const m = pendingMedia[i];
          setUploadStatus(
            `미디어 업로드 ${i + 1}/${pendingMedia.length} (${
              m.kind === "video" ? "영상" : "사진"
            })`,
          );
          try {
            let uploadUri = m.localUri;
            let thumbnailLocalUri: string | null = null;
            if (m.kind === "video") {
              const compressed = await tryCompressVideo(m.localUri);
              uploadUri = compressed.uri;
              thumbnailLocalUri = compressed.thumbnailUri;
            }
            const uploaded = await mediaStorage.upload({
              scope: { type: "dive", diveId },
              localUri: uploadUri,
              originalFilename: m.filename,
              contentType: m.contentType,
              kind: m.kind,
            });
            // 비디오 썸네일은 로컬 file:// 라서 그대로 DB에 넣으면 다른 사용자/세션에서 못 봄.
            // 별도 이미지로 NAS 에 올리고 그 URL 을 저장.
            let thumbnailPublicUrl: string | null = null;
            if (m.kind === "video" && thumbnailLocalUri) {
              try {
                const thumbUploaded = await mediaStorage.upload({
                  scope: { type: "dive", diveId },
                  localUri: thumbnailLocalUri,
                  originalFilename: `thumb-${Date.now()}.jpg`,
                  contentType: "image/jpeg",
                  kind: "image",
                });
                thumbnailPublicUrl = thumbUploaded.url;
              } catch (te) {
                console.warn("thumbnail upload failed", te);
              }
            }
            const { error: mediaError } = await supabase
              .from("dive_media")
              .insert({
                dive_id: diveId,
                storage_url: uploaded.url,
                kind: m.kind,
                provider: uploaded.provider,
                file_size_bytes: uploaded.sizeBytes,
                original_filename: uploaded.filename,
                thumbnail_url: thumbnailPublicUrl,
                duration_seconds: m.durationSeconds,
                width: m.width,
                height: m.height,
              });
            if (mediaError) throw mediaError;
          } catch (e) {
            uploadFailures += 1;
            console.warn("dive media upload failed", e);
          }
        }
        setUploadStatus(null);
      }

      await queryClient.invalidateQueries({ queryKey: ["dives", userId] });
      // 다이브 자체는 저장됐으므로 partial 실패는 토스트성 알림으로만 알림 — back() 은 실행.
      const warnings: string[] = [];
      if (equipmentLinkError) {
        warnings.push(`장비 연결 실패: ${equipmentLinkError}`);
      }
      if (buddyLinkError) {
        warnings.push(`버디 연결 실패: ${buddyLinkError}`);
      }
      if (uploadFailures > 0) {
        warnings.push(
          `${uploadFailures}개 미디어 업로드 실패 (로그 상세에서 다시 시도 가능)`,
        );
      }
      if (warnings.length > 0) {
        showAlert("일부 항목 저장 안됨", warnings.join("\n\n"));
      }
      router.back();
    } catch (err: unknown) {
      showAlert("저장 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-bold text-gray-900">새 로그 기록</Text>
          <Pressable
            onPress={() => router.back()}
            className="p-2 bg-gray-100 rounded-full"
            disabled={submitting}
          >
            <X size={20} color="#374151" />
          </Pressable>
        </View>

        <LocationField
          value={location}
          onChange={setLocation}
          disabled={submitting}
        />

        <DateField
          label="다이브 날짜 *"
          value={diveDate}
          onChange={setDiveDate}
          mode="date"
          placeholder="YYYY-MM-DD"
          disabled={submitting}
          maximumDate={new Date()}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <DateField
              label="입수 시간 *"
              value={entryTime}
              onChange={setEntryTime}
              mode="time"
              placeholder="HH:MM"
              disabled={submitting}
            />
          </View>
          <View className="flex-1">
            <DateField
              label="출수 시간 *"
              value={exitTime}
              onChange={setExitTime}
              mode="time"
              placeholder="HH:MM"
              disabled={submitting}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label="최대 수심 (m) *"
              value={form.maxDepth}
              onChangeText={(v) => update("maxDepth", v)}
              keyboardType="decimal-pad"
              placeholder="18.5"
              editable={!submitting}
            />
          </View>
          <View className="flex-1">
            <Field
              label="평균 수심 (m)"
              value={form.avgDepth}
              onChangeText={(v) => update("avgDepth", v)}
              keyboardType="decimal-pad"
              placeholder="12.0"
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
              placeholder="22"
              editable={!submitting}
            />
          </View>
          <View className="flex-1">
            <Field
              label="시야 (m)"
              value={form.visibility}
              onChangeText={(v) => update("visibility", v)}
              keyboardType="number-pad"
              placeholder="15"
              editable={!submitting}
            />
          </View>
        </View>

        <Field
          label="다이브 시간 (분) (자동 계산)"
          value={durationMinutes !== null ? String(durationMinutes) : ""}
          onChangeText={() => {
            /* 자동 계산되는 값이라 수정 불가 */
          }}
          keyboardType="number-pad"
          placeholder="입수/출수 시간을 입력하면 자동 계산돼요"
          editable={false}
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
                placeholder="11"
                editable={!submitting}
              />
            </View>
            <View className="flex-1">
              <Field
                label="시작 (bar)"
                value={form.tankStartBar}
                onChangeText={(v) => update("tankStartBar", v)}
                keyboardType="decimal-pad"
                placeholder="200"
                editable={!submitting}
              />
            </View>
            <View className="flex-1">
              <Field
                label="종료 (bar)"
                value={form.tankEndBar}
                onChangeText={(v) => update("tankEndBar", v)}
                keyboardType="decimal-pad"
                placeholder="50"
                editable={!submitting}
              />
            </View>
          </View>
        </View>

        <View className="flex-row gap-3 items-end">
          <View className="flex-1 gap-2">
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
                    disabled={submitting}
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
        </View>

        <Field
          label="수면 휴식 (분, 직전 다이브와의 간격)"
          value={form.surfaceIntervalMin}
          onChangeText={(v) => update("surfaceIntervalMin", v)}
          keyboardType="number-pad"
          placeholder="60"
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
                  accessibilityLabel={`날씨 ${label}`}
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
          disabled={submitting}
        />

        <BuddyPickerField
          items={userBuddies ?? []}
          pendingProfiles={Array.from(pendingNewBuddies.values())}
          selectedIds={selectedBuddyIds}
          onToggle={toggleBuddy}
          onOpenPicker={() => setBuddyPickerOpen(true)}
          disabled={submitting}
        />

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-bold text-gray-700">사진 / 영상</Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => pickMedia("image")}
                disabled={submitting}
                className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full"
              >
                <ImagePlus size={12} color={colors.brand[700]} />
                <Text className="text-[10px] font-black text-brand-700">
                  사진
                </Text>
              </Pressable>
              <Pressable
                onPress={() => pickMedia("video")}
                disabled={submitting}
                className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full"
              >
                <VideoIcon size={12} color={colors.brand[700]} />
                <Text className="text-[10px] font-black text-brand-700">
                  영상
                </Text>
              </Pressable>
            </View>
          </View>

          {pendingMedia.length === 0 ? (
            <Text className="text-[11px] text-gray-400">
              저장 시 함께 업로드돼요. 영상은 자동 압축됩니다.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {pendingMedia.map((m, idx) => (
                <View
                  key={`${m.localUri}-${idx}`}
                  className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100"
                >
                  <Image
                    source={{ uri: m.localUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  {m.kind === "video" ? (
                    <View className="absolute inset-0 items-center justify-center">
                      <View className="w-7 h-7 rounded-full bg-black/50 items-center justify-center">
                        <Play size={12} color="#fff" />
                      </View>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => removePending(idx)}
                    disabled={submitting}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 items-center justify-center"
                    hitSlop={8}
                  >
                    <X size={11} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

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
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color={colors.brand.fg} />
              {uploadStatus ? (
                <Text className="text-brand-fg text-xs font-black">
                  {uploadStatus}
                </Text>
              ) : null}
            </View>
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
          // 카탈로그 항목 → 내 장비로 자동 등록 + 이번 다이브 선택에 반영.
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
          // 검색에서 새로 고른 경우: 선택만 누적. user_buddies INSERT 는 로그 저장 시점에 일괄.
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
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  editable?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  editable = true,
}: FieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-bold text-gray-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
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

// 장비 섹션은 src/components/EquipmentPicker.tsx 로 분리됨
