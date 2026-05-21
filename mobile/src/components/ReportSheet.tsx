import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import { X, Flag } from "lucide-react-native";

import { colors } from "@/src/lib/colors";
import {
  BOARD_REPORT_REASONS,
  type BoardReportReason,
} from "@/src/hooks/use-board-reports";

type Props = {
  visible: boolean;
  /** 헤더에 표시할 컨텍스트 ("게시글" / "댓글" 등) */
  targetLabel: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: { reason: BoardReportReason; detail: string | null }) => void;
};

export function ReportSheet({
  visible,
  targetLabel,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState<BoardReportReason | null>(null);
  const [detail, setDetail] = useState("");

  // 모달이 닫힐 때 상태 초기화 — 다음 신고 시 이전 선택이 남아있지 않게.
  useEffect(() => {
    if (!visible) {
      setReason(null);
      setDetail("");
    }
  }, [visible]);

  const canSubmit = reason !== null && !submitting;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View className="bg-white rounded-t-3xl px-5 pt-3 pb-8">
                <View className="items-center mb-2">
                  <View className="w-10 h-1 rounded-full bg-gray-200" />
                </View>

                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <Flag size={18} color="#DC2626" />
                    <Text className="text-base font-black text-gray-900">
                      {targetLabel} 신고
                    </Text>
                  </View>
                  <Pressable
                    onPress={onClose}
                    hitSlop={8}
                    className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
                    disabled={submitting}
                  >
                    <X size={16} color="#374151" />
                  </Pressable>
                </View>

                <Text className="text-xs text-gray-500 mb-3">
                  신고 사유를 선택해주세요. 운영자가 검토 후 처리합니다.
                </Text>

                <View className="flex-row flex-wrap gap-2 mb-4">
                  {BOARD_REPORT_REASONS.map((r) => {
                    const active = reason === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        onPress={() => setReason(r.value)}
                        disabled={submitting}
                        className={`px-3 py-2 rounded-full border ${
                          active
                            ? "bg-rose-600 border-rose-600"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <Text
                          className={`text-xs font-black ${
                            active ? "text-white" : "text-gray-600"
                          }`}
                        >
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View className="gap-1 mb-4">
                  <Text className="text-xs font-bold text-gray-700">
                    상세 내용 (선택)
                  </Text>
                  <TextInput
                    value={detail}
                    onChangeText={setDetail}
                    placeholder="구체적인 상황을 적어주시면 검토에 도움돼요."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    maxLength={500}
                    editable={!submitting}
                    className="border border-gray-200 rounded-2xl p-3 text-sm text-gray-900 min-h-20"
                  />
                </View>

                <Pressable
                  onPress={() =>
                    reason &&
                    onSubmit({
                      reason,
                      detail: detail.trim() ? detail.trim() : null,
                    })
                  }
                  disabled={!canSubmit}
                  className={`p-4 rounded-2xl items-center ${
                    canSubmit ? "bg-rose-600" : "bg-gray-200"
                  }`}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.brand.fg} />
                  ) : (
                    <Text
                      className={`font-black ${
                        canSubmit ? "text-white" : "text-gray-500"
                      }`}
                    >
                      신고하기
                    </Text>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
