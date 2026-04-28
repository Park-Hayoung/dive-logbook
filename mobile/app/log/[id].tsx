import { useState } from "react";
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
  X,
} from "lucide-react-native";

import { useDive } from "@/src/hooks/use-dives";
import { useCreateFeed } from "@/src/hooks/use-feeds";
import { useAuthStore } from "@/src/store/auth-store";
import { StatBox, DiveMediaGallery } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";
import { formatDate, formatTime } from "@/src/lib/format";

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: dive, isLoading } = useDive(id);
  const createFeed = useCreateFeed(userId);

  const [shareOpen, setShareOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [sharing, setSharing] = useState(false);

  const onShare = async () => {
    if (!dive) return;
    setSharing(true);
    try {
      const defaultText = `${dive.location}, ${dive.country} · 최대 ${dive.maxDepth.toFixed(1)}m / ${dive.durationMinutes}분`;
      const finalContent = caption.trim() || defaultText;
      await createFeed.mutateAsync({
        content: finalContent,
        type: "log",
        location: dive.location,
        linkedDiveId: dive.id,
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
              <Pressable
                onPress={() => setShareOpen(true)}
                className="flex-row items-center gap-1.5 bg-brand-50 px-3 py-1.5 rounded-full"
              >
                <Share2 size={12} color="#2563EB" />
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

          <Text className="text-xs font-black text-brand-600 bg-brand-50 self-start px-2 py-0.5 rounded-lg mb-3">
            DIVE #{dive.diveNumber}
          </Text>
          <Text className="text-3xl font-black text-gray-900">
            {dive.location}
          </Text>
          <Text className="text-sm text-gray-500 mt-1">{dive.country}</Text>
          {dive.point ? (
            <View className="flex-row items-center gap-1.5 mt-3">
              <Anchor size={14} color="#2563EB" />
              <Text className="text-sm font-bold text-brand-600">
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
                icon={<Navigation size={10} color="#DBEAFE" />}
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

          <View className="bg-white p-5 rounded-3xl border border-gray-100 mt-2">
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
            <Text className="text-[10px] font-black text-gray-400 uppercase mb-2">
              장비 / 버디
            </Text>
            <Text className="text-xs text-gray-400">
              추후 추가 — 함께한 다이버 태그, 사용 장비 기록
            </Text>
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
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-black">올리기</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
