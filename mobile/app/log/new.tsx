import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/src/store/auth-store";
import { supabase } from "@/src/services/supabase";
import { KeyboardSafeScroll, DateField } from "@/src/components";

type FieldKey =
  | "country"
  | "location"
  | "point"
  | "maxDepth"
  | "avgDepth"
  | "waterTemp"
  | "visibility"
  | "durationMinutes"
  | "memo";

type FormState = Record<FieldKey, string>;

const INITIAL: FormState = {
  country: "",
  location: "",
  point: "",
  maxDepth: "",
  avgDepth: "",
  waterTemp: "",
  visibility: "",
  durationMinutes: "",
  memo: "",
};

const parseNumber = (s: string): number | null => {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

export default function NewLogScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [diveStart, setDiveStart] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key: FieldKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async () => {
    if (!userId) {
      Alert.alert("오류", "로그인 세션이 없습니다.");
      return;
    }
    if (!form.country.trim() || !form.location.trim()) {
      Alert.alert("필수 항목", "국가와 지역은 필수입니다.");
      return;
    }
    const maxDepth = parseNumber(form.maxDepth);
    if (maxDepth === null || maxDepth <= 0) {
      Alert.alert("최대 수심", "0보다 큰 숫자를 입력해주세요.");
      return;
    }
    const duration = parseNumber(form.durationMinutes);
    if (duration === null || duration <= 0) {
      Alert.alert("다이브 시간", "분 단위 숫자를 입력해주세요.");
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
      // If user picked a dive start time, use it; otherwise anchor to "now - duration".
      const startedAt = diveStart ?? new Date(Date.now() - duration * 60_000);
      const endedAt = new Date(startedAt.getTime() + duration * 60_000);

      const { error } = await supabase.from("dives").insert({
        user_id: userId,
        dive_number: nextNumber,
        country: form.country.trim(),
        location: form.location.trim(),
        point: form.point.trim() || null,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        max_depth: maxDepth,
        avg_depth: parseNumber(form.avgDepth),
        water_temp: parseNumber(form.waterTemp),
        visibility: parseNumber(form.visibility),
        weather: "sunny",
        memo: form.memo.trim() || null,
        is_verified: false,
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["dives", userId] });
      router.back();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      Alert.alert("저장 실패", message);
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
          <Text className="text-2xl font-black text-gray-900">새 로그 기록</Text>
          <Pressable
            onPress={() => router.back()}
            className="p-2 bg-gray-100 rounded-full"
            disabled={submitting}
          >
            <X size={20} color="#374151" />
          </Pressable>
        </View>

        <Text className="text-[10px] text-gray-400">
          BLE 통합 전 임시 수동 입력 폼 · is_verified=false
        </Text>

        <Field
          label="국가 *"
          value={form.country}
          onChangeText={(v) => update("country", v)}
          placeholder="대한민국"
          editable={!submitting}
        />
        <Field
          label="지역 *"
          value={form.location}
          onChangeText={(v) => update("location", v)}
          placeholder="제주도 서귀포"
          editable={!submitting}
        />
        <Field
          label="포인트"
          value={form.point}
          onChangeText={(v) => update("point", v)}
          placeholder="문섬 새끼섬"
          editable={!submitting}
        />

        <DateField
          label="다이브 시작 (선택, 없으면 현재 시각 기준)"
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
          label="다이브 시간 (분) *"
          value={form.durationMinutes}
          onChangeText={(v) => update("durationMinutes", v)}
          keyboardType="number-pad"
          placeholder="42"
          editable={!submitting}
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
