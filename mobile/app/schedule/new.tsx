import { useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useAuthStore } from "@/src/store/auth-store";
import { useCreateDiveSchedule } from "@/src/hooks/use-dive-schedules";
import { KeyboardSafeScroll, DateField, dateToYmd } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

export default function NewScheduleScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const create = useCreateDiveSchedule(userId);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [point, setPoint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const t = title.trim();
    if (t.length < 2) {
      showAlert("제목", "최소 2자 이상이어야 해요.");
      return;
    }
    if (!startDate || !endDate) {
      showAlert("날짜", "시작일과 종료일을 모두 선택해주세요.");
      return;
    }
    if (endDate < startDate) {
      showAlert("날짜", "종료일이 시작일보다 빠를 수 없어요.");
      return;
    }

    setSubmitting(true);
    try {
      await create.mutateAsync({
        title: t,
        startDate: dateToYmd(startDate),
        endDate: dateToYmd(endDate),
        point: point.trim() || null,
      });
      router.back();
    } catch (err: unknown) {
      showAlert("저장 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text style={{ fontFamily: "KCCDodamdodam" }} className="text-2xl font-title text-gray-900">새 일정</Text>
          <Pressable
            onPress={() => router.back()}
            className="p-2 bg-gray-100 rounded-full"
            disabled={submitting}
          >
            <X size={20} color="#374151" />
          </Pressable>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">제목 *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="예: 필리핀 보홀 펀다이빙"
            placeholderTextColor="#9CA3AF"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />
        </View>

        <DateField
          label="시작일 *"
          value={startDate}
          onChange={setStartDate}
          placeholder="날짜 선택"
          disabled={submitting}
        />

        <DateField
          label="종료일 *"
          value={endDate}
          onChange={setEndDate}
          placeholder="날짜 선택"
          disabled={submitting}
          minimumDate={startDate ?? undefined}
        />

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">포인트</Text>
          <TextInput
            value={point}
            onChangeText={setPoint}
            placeholder="알로나 비치 / Balicasag Island 등"
            placeholderTextColor="#9CA3AF"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
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

        <Text className="text-[10px] text-gray-400 text-center mt-2">
          샵 연결 · 버디 초대는 추후 추가
        </Text>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
