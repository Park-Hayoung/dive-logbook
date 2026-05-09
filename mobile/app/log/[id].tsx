import { useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  ShieldCheck,
  Navigation,
  Clock,
  Thermometer,
  Eye,
  Anchor,
  CalendarDays,
  Share2,
  Pencil,
  Trash2,
  X,
} from "lucide-react-native";

import {
  useDive,
  useDeleteDive,
  useDiveEquipmentDetails,
} from "@/src/hooks/use-dives";
import { useCreateFeed } from "@/src/hooks/use-feeds";
import { useDiveMedia } from "@/src/hooks/use-dive-media";
import { useDiveGasMixes } from "@/src/hooks/use-dive-samples";
import { useAuthStore } from "@/src/store/auth-store";
import { StatBox, DiveMediaGallery, DiveProfileGraph } from "@/src/components";
import { CATEGORY_LABEL } from "@/src/hooks/use-equipment";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";
import { formatDate, formatTime } from "@/src/lib/format";

const ENTRY_TYPE_LABEL: Record<string, string> = {
  boat: "보트",
  shore: "비치",
  liveaboard: "리브어보드",
};

const STYLE_LABEL: Record<string, string> = {
  drift: "드리프트",
  wreck: "랙",
  night: "야간",
  deep: "딥",
  wall: "월",
  cave: "케이브",
  training: "교육",
};

const CURRENT_LABEL: Record<string, string> = {
  none: "조류 없음",
  mild: "약한 조류",
  moderate: "보통 조류",
  strong: "강한 조류",
};

function gasName(o2: number, he: number): string {
  if (he > 0) return `Tx ${o2}/${he}`;
  if (o2 === 21) return "Air";
  if (o2 === 100) return "O₂";
  return `EAN${o2}`;
}

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: dive, isLoading } = useDive(id);
  const { data: equipment = [], isLoading: equipmentLoading } =
    useDiveEquipmentDetails(id);
  const { data: media = [] } = useDiveMedia(id);
  const { data: gasMixes = [] } = useDiveGasMixes(id);
  const createFeed = useCreateFeed(userId);
  const deleteDive = useDeleteDive(userId);

  const [shareOpen, setShareOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = !!dive && !!userId && dive.userId === userId;

  const handleEdit = () => {
    if (!dive) return;
    router.push(`/log/edit/${dive.id}` as never);
  };

  const handleDelete = () => {
    if (!dive) return;
    showAlert(
      "로그 삭제",
      "이 다이브 로그를 삭제할까요? 첨부된 사진/영상도 함께 사라집니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteDive.mutateAsync(dive.id);
              router.back();
            } catch (e) {
              showAlert("삭제 실패", friendlyError(e));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const onShare = async () => {
    if (!dive) return;
    setSharing(true);
    try {
      const defaultText = `${dive.location}, ${dive.country} · 최대 ${dive.maxDepth.toFixed(1)}m / ${dive.durationMinutes}분`;
      const finalContent = caption.trim() || defaultText;
      const cover =
        media.find((m) => m.kind === "image")?.storageUrl ??
        media[0]?.thumbnailUrl ??
        null;
      await createFeed.mutateAsync({
        content: finalContent,
        type: "log",
        location: dive.location,
        linkedDiveId: dive.id,
        imageUrl: cover,
      });
      setShareOpen(false);
      setCaption("");
      showAlert("공유됨", "피드에 다이브 로그를 게시했어요.", [
        { text: "확인", onPress: () => router.push("/(tabs)/feed") },
        { text: "닫기" },
      ]);
    } catch (err: unknown) {
      showAlert(
        "공유 실패",
        friendlyError(err),
      );
    } finally {
      setSharing(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!dive) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-gray-400 mb-4">로그를 찾을 수 없어요.</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-gray-900 px-5 py-3 rounded-2xl"
        >
          <Text className="text-white font-black">돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="bg-white px-5 pt-4 pb-6 rounded-b-[2.5rem] border-b border-gray-100">
          <View className="flex-row justify-between items-center mb-4">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
            >
              <ChevronLeft size={22} color="#374151" />
            </Pressable>
            <View className="flex-row items-center gap-2">
              {isOwner ? (
                <>
                  <Pressable
                    onPress={handleEdit}
                    disabled={deleting}
                    accessibilityLabel="로그 수정"
                    className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
                  >
                    <Pencil size={14} color="#374151" />
                  </Pressable>
                  <Pressable
                    onPress={handleDelete}
                    disabled={deleting}
                    accessibilityLabel="로그 삭제"
                    className="w-8 h-8 bg-red-50 rounded-full items-center justify-center"
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Trash2 size={14} color="#DC2626" />
                    )}
                  </Pressable>
                </>
              ) : null}
              <Pressable
                onPress={() => setShareOpen(true)}
                className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full"
              >
                <Share2 size={12} color={colors.brand[700]} />
                <Text className="text-[10px] font-black text-brand-700">
                  공유
                </Text>
              </Pressable>
              {dive.isVerified ? (
                <View className="flex-row items-center gap-1 bg-emerald-50 px-2.5 py-1.5 rounded-full">
                  <ShieldCheck size={12} color="#059669" />
                  <Text className="text-[10px] font-black text-emerald-700">
                    Verified
                  </Text>
                </View>
              ) : (
                <View className="bg-gray-100 px-2.5 py-1.5 rounded-full">
                  <Text className="text-[10px] font-black text-gray-500">
                    수동 입력
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text className="text-xs font-black text-brand-700 bg-brand-50 self-start px-2 py-0.5 rounded-lg mb-3">
            DIVE #{dive.diveNumber}
          </Text>
          <Text className="text-3xl font-black text-gray-900">
            {dive.location}
          </Text>
          <Text className="text-sm text-gray-500 mt-1">{dive.country}</Text>
          {dive.point ? (
            <View className="flex-row items-center gap-1.5 mt-3">
              <Anchor size={14} color={colors.brand[700]} />
              <Text className="text-sm font-bold text-brand-700">
                {dive.point}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="px-5 pt-5">
          <View className="flex-row items-center gap-1.5 mb-3">
            <CalendarDays size={14} color="#6B7280" />
            <Text className="text-xs text-gray-600 font-bold">
              {formatDate(dive.startedAt)} · {formatTime(dive.startedAt)} ~{" "}
              {formatTime(dive.endedAt)}
            </Text>
          </View>

          <View className="flex-row gap-2 mb-4">
            <View className="flex-1">
              <StatBox
                label="MAX DEPTH"
                value={dive.maxDepth.toFixed(1)}
                unit="m"
                highlighted
                icon={<Navigation size={10} color={colors.brand.fg} />}
              />
            </View>
            <View className="flex-1">
              <StatBox
                label="시간"
                value={dive.durationMinutes}
                unit="분"
                icon={<Clock size={10} color="#9CA3AF" />}
              />
            </View>
          </View>

          <View className="flex-row gap-2 mb-4">
            <View className="flex-1">
              <StatBox
                label="평균 수심"
                value={dive.avgDepth ? dive.avgDepth.toFixed(1) : "—"}
                unit={dive.avgDepth ? "m" : ""}
              />
            </View>
            <View className="flex-1">
              <StatBox
                label="수온"
                value={dive.waterTemp ? dive.waterTemp.toFixed(1) : "—"}
                unit={dive.waterTemp ? "°C" : ""}
                icon={<Thermometer size={10} color="#9CA3AF" />}
              />
            </View>
            <View className="flex-1">
              <StatBox
                label="시야"
                value={dive.visibility ? dive.visibility : "—"}
                unit={dive.visibility ? "m" : ""}
                icon={<Eye size={10} color="#9CA3AF" />}
              />
            </View>
          </View>

          {dive.tankStartBar !== null || dive.tankEndBar !== null ? (
            <View className="flex-row gap-2 mb-4">
              <View className="flex-1">
                <StatBox
                  label="시작 압력"
                  value={dive.tankStartBar?.toFixed(0) ?? "—"}
                  unit={dive.tankStartBar !== null ? "bar" : ""}
                />
              </View>
              <View className="flex-1">
                <StatBox
                  label="종료 압력"
                  value={dive.tankEndBar?.toFixed(0) ?? "—"}
                  unit={dive.tankEndBar !== null ? "bar" : ""}
                />
              </View>
              <View className="flex-1">
                <StatBox
                  label="공기 소모"
                  value={
                    dive.consumptionBarPerMin?.toFixed(1) ??
                    (dive.tankStartBar !== null && dive.tankEndBar !== null
                      ? (dive.tankStartBar - dive.tankEndBar).toFixed(0)
                      : "—")
                  }
                  unit={dive.consumptionBarPerMin !== null ? "bar/min" : "bar"}
                />
              </View>
            </View>
          ) : null}

          <View className="mt-2">
            <DiveProfileGraph diveId={dive.id} />
          </View>

          {gasMixes.length > 0 ? (
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mt-3">
              <Text className="text-[10px] font-black text-gray-400 uppercase mb-3">
                가스 믹스
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {gasMixes.map((g) => (
                  <View
                    key={g.index}
                    className={`px-3 py-2 rounded-2xl border ${
                      g.isDiluent
                        ? "bg-amber-50 border-amber-100"
                        : "bg-brand-50 border-brand-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-black ${
                        g.isDiluent ? "text-amber-700" : "text-brand-700"
                      }`}
                    >
                      {gasName(g.o2, g.he)}
                      {g.isDiluent ? " (Dil)" : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {dive.entryType ||
          (dive.diveStyle && dive.diveStyle.length > 0) ||
          dive.currentStrength ||
          dive.surfaceIntervalMin !== null ? (
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mt-3">
              <Text className="text-[10px] font-black text-gray-400 uppercase mb-3">
                다이브 조건
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {dive.entryType ? (
                  <ConditionChip
                    label={ENTRY_TYPE_LABEL[dive.entryType] ?? dive.entryType}
                  />
                ) : null}
                {(dive.diveStyle ?? []).map((s) => (
                  <ConditionChip key={s} label={STYLE_LABEL[s] ?? s} />
                ))}
                {dive.currentStrength ? (
                  <ConditionChip
                    label={
                      CURRENT_LABEL[dive.currentStrength] ?? dive.currentStrength
                    }
                  />
                ) : null}
                {dive.surfaceIntervalMin !== null ? (
                  <ConditionChip
                    label={`수면휴식 ${dive.surfaceIntervalMin}분`}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {dive.diveMode || dive.decoModel || dive.gfLow !== null ? (
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mt-3">
              <Text className="text-[10px] font-black text-gray-400 uppercase mb-3">
                컴퓨터 설정
              </Text>
              <View className="gap-1.5">
                {dive.diveMode ? (
                  <InfoLine label="모드" value={dive.diveMode} />
                ) : null}
                {dive.decoModel ? (
                  <InfoLine label="감압 모델" value={dive.decoModel} />
                ) : null}
                {dive.gfLow !== null && dive.gfHigh !== null ? (
                  <InfoLine label="GF" value={`${dive.gfLow} / ${dive.gfHigh}`} />
                ) : null}
                {dive.atmosphericMbar !== null ? (
                  <InfoLine
                    label="기압"
                    value={`${dive.atmosphericMbar} mbar`}
                  />
                ) : null}
                {dive.waterType ? (
                  <InfoLine
                    label="수질"
                    value={dive.waterType === "fresh" ? "담수" : "염수"}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          <View className="bg-white p-5 rounded-3xl border border-gray-100 mt-3">
            <Text className="text-[10px] font-black text-gray-400 uppercase mb-2">
              Dive Diary
            </Text>
            <Text className="text-sm text-gray-700 leading-5">
              {dive.memo?.trim() || "메모가 없어요."}
            </Text>
          </View>

          <View className="mt-3">
            <DiveMediaGallery diveId={dive.id} />
          </View>

          <View className="bg-white p-5 rounded-3xl border border-gray-100 mt-3">
            <Text className="text-[10px] font-black text-gray-400 uppercase mb-3">
              사용 장비
            </Text>
            {equipmentLoading ? (
              <ActivityIndicator size="small" />
            ) : equipment.length === 0 ? (
              <Text className="text-xs text-gray-400">
                기록된 장비가 없어요.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {equipment.map((eq) => (
                  <View
                    key={eq.id}
                    className="flex-row items-center gap-2 bg-brand-50 border border-brand-100 rounded-2xl px-3 py-2"
                  >
                    <View className="w-7 h-7 rounded-lg bg-white items-center justify-center">
                      <Anchor size={13} color={colors.brand[700]} />
                    </View>
                    <View>
                      <Text className="text-[9px] font-black text-brand-700 uppercase">
                        {CATEGORY_LABEL[
                          eq.category as keyof typeof CATEGORY_LABEL
                        ] ?? eq.category}
                      </Text>
                      <Text
                        className="text-xs font-black text-gray-900 max-w-[200px]"
                        numberOfLines={1}
                      >
                        {eq.brand} {eq.model}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={shareOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !sharing && setShareOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-3xl p-5 pb-8">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-black text-gray-900">
                피드에 공유
              </Text>
              <Pressable
                onPress={() => setShareOpen(false)}
                disabled={sharing}
                className="p-2 bg-gray-100 rounded-full"
              >
                <X size={18} color="#374151" />
              </Pressable>
            </View>
            <Text className="text-xs text-gray-500 mb-3">
              {dive.location}, {dive.country} · 최대 {dive.maxDepth.toFixed(1)}m
              / {dive.durationMinutes}분
            </Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="한마디 (선택) — 비워두면 다이브 정보가 자동으로 들어갑니다"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!sharing}
              className="border border-gray-200 rounded-2xl p-4 text-sm text-gray-900 min-h-24 mb-3"
            />
            <Pressable
              onPress={onShare}
              disabled={sharing}
              className="bg-brand-600 p-4 rounded-2xl items-center"
            >
              {sharing ? (
                <ActivityIndicator color={colors.brand.fg} />
              ) : (
                <Text className="text-brand-fg font-black">올리기</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function ConditionChip({ label }: { label: string }) {
  return (
    <View className="bg-gray-100 px-3 py-1.5 rounded-full">
      <Text className="text-[11px] font-black text-gray-700">{label}</Text>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-[11px] font-bold text-gray-500">{label}</Text>
      <Text className="text-xs font-black text-gray-900">{value}</Text>
    </View>
  );
}
