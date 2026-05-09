import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { ChevronLeft, RotateCcw } from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useAddCertification,
  useCertifications,
  type CardType,
} from "@/src/hooks/use-certifications";
import { KeyboardSafeScroll } from "@/src/components";
import { colors } from "@/src/lib/colors";
import { showAlert } from "@/src/lib/alert";
import { friendlyError } from "@/src/lib/error-messages";

const ORGS = [
  "PADI",
  "SSI",
  "SDI",
  "TDI",
  "NAUI",
  "CMAS",
  "BSAC",
  "RAID",
  "IANTD",
  "KUDA",
  "기타",
] as const;

const LEVELS = [
  "Open Water",
  "Advanced",
  "Rescue",
  "Divemaster",
  "Instructor",
  "기타",
] as const;

export default function CardAddScreen() {
  const router = useRouter();
  const { uri, from, source } = useLocalSearchParams<{
    uri: string;
    from?: string;
    source?: string;
  }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: existing } = useCertifications(userId);
  const add = useAddCertification(userId);

  const [organization, setOrganization] = useState<string>("PADI");
  const [orgCustom, setOrgCustom] = useState("");
  const [level, setLevel] = useState<string>("Open Water");
  const [levelCustom, setLevelCustom] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  // Heuristic default: 갤러리에서 가져왔으면 e카드, 카메라 촬영이면 실물 카드.
  // 사용자가 토글로 바꿀 수 있음.
  const [cardType, setCardType] = useState<CardType>(
    source === "gallery" ? "electronic" : "physical",
  );

  // First card auto-becomes the primary so the profile badge has something to
  // show without the user having to flip a switch.
  useEffect(() => {
    if (existing && existing.length === 0) setIsPrimary(true);
  }, [existing]);

  const submitting = add.isPending;

  const onSave = async () => {
    if (!uri) {
      showAlert("이미지 없음", "촬영된 카드 이미지가 없어요.");
      return;
    }
    const finalOrg =
      organization === "기타" ? orgCustom.trim() : organization;
    const finalLevel = level === "기타" ? levelCustom.trim() : level;
    if (!finalOrg) {
      showAlert("단체", "자격증 단체를 입력해주세요.");
      return;
    }
    if (!finalLevel) {
      showAlert("등급", "자격등급을 입력해주세요.");
      return;
    }
    try {
      await add.mutateAsync({
        organization: finalOrg,
        level: finalLevel,
        certNumber: certNumber.trim() || null,
        cardLocalUri: uri,
        cardType,
        isPrimary,
      });
      router.replace({
        pathname: "/profile/cards" as never,
        params: from ? { from } : {},
      } as never);
    } catch (err) {
      showAlert("등록 실패", friendlyError(err));
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          disabled={submitting}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={20} color="#374151" />
        </Pressable>
        <Text className="text-base font-black text-gray-900">자격증 정보</Text>
        <View className="w-10" />
      </View>

      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        {uri ? (
          <View className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
            <View
              style={{
                width: "100%",
                height: 240,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={{ uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            </View>
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: "/profile/cards/capture" as never,
                  params: from ? { from } : {},
                } as never)
              }
              disabled={submitting}
              className="flex-row items-center justify-center gap-2 py-2.5 border-t border-gray-200 bg-white"
            >
              <RotateCcw size={12} color="#374151" />
              <Text className="text-[11px] font-bold text-gray-700">
                다시 선택
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View className="gap-1.5">
          <Text className="text-xs font-bold text-gray-700">카드 종류</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setCardType("physical")}
              disabled={submitting}
              className={`flex-1 px-3 py-3 rounded-xl border ${
                cardType === "physical"
                  ? "bg-brand-600 border-brand-600"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`text-xs font-black text-center ${
                  cardType === "physical" ? "text-brand-fg" : "text-gray-700"
                }`}
              >
                실물 카드
              </Text>
              <Text
                className={`text-[10px] text-center mt-0.5 ${
                  cardType === "physical"
                    ? "text-brand-fg/80"
                    : "text-gray-400"
                }`}
              >
                플라스틱 카드 촬영
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCardType("electronic")}
              disabled={submitting}
              className={`flex-1 px-3 py-3 rounded-xl border ${
                cardType === "electronic"
                  ? "bg-brand-600 border-brand-600"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`text-xs font-black text-center ${
                  cardType === "electronic" ? "text-brand-fg" : "text-gray-700"
                }`}
              >
                e카드
              </Text>
              <Text
                className={`text-[10px] text-center mt-0.5 ${
                  cardType === "electronic"
                    ? "text-brand-fg/80"
                    : "text-gray-400"
                }`}
              >
                앱 스크린샷
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="gap-1.5">
          <Text className="text-xs font-bold text-gray-700">단체</Text>
          <View className="flex-row flex-wrap gap-2">
            {ORGS.map((o) => (
              <Pressable
                key={o}
                onPress={() => setOrganization(o)}
                disabled={submitting}
                className={`px-3 py-2 rounded-xl border ${
                  organization === o
                    ? "bg-brand-600 border-brand-600"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    organization === o ? "text-brand-fg" : "text-gray-700"
                  }`}
                >
                  {o}
                </Text>
              </Pressable>
            ))}
          </View>
          {organization === "기타" ? (
            <TextInput
              value={orgCustom}
              onChangeText={setOrgCustom}
              placeholder="단체 이름 입력"
              placeholderTextColor="#9CA3AF"
              editable={!submitting}
              className="border border-gray-200 rounded-2xl p-3 text-sm text-gray-900 mt-1"
            />
          ) : null}
        </View>

        <View className="gap-1.5">
          <Text className="text-xs font-bold text-gray-700">자격등급</Text>
          <View className="flex-row flex-wrap gap-2">
            {LEVELS.map((l) => (
              <Pressable
                key={l}
                onPress={() => setLevel(l)}
                disabled={submitting}
                className={`px-3 py-2 rounded-xl border ${
                  level === l
                    ? "bg-brand-600 border-brand-600"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    level === l ? "text-brand-fg" : "text-gray-700"
                  }`}
                >
                  {l}
                </Text>
              </Pressable>
            ))}
          </View>
          {level === "기타" ? (
            <TextInput
              value={levelCustom}
              onChangeText={setLevelCustom}
              placeholder="등급 입력 (예: Tec 50)"
              placeholderTextColor="#9CA3AF"
              editable={!submitting}
              className="border border-gray-200 rounded-2xl p-3 text-sm text-gray-900 mt-1"
            />
          ) : null}
        </View>

        <View className="gap-1.5">
          <Text className="text-xs font-bold text-gray-700">
            카드 번호 (선택)
          </Text>
          <TextInput
            value={certNumber}
            onChangeText={setCertNumber}
            placeholder="예: 1234-5678"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-3 text-sm text-gray-900"
          />
        </View>

        <Pressable
          onPress={() => setIsPrimary((v) => !v)}
          disabled={submitting}
          className="flex-row items-center justify-between bg-gray-50 rounded-2xl p-4"
        >
          <View className="flex-1 mr-3">
            <Text className="text-sm font-black text-gray-900">대표 카드</Text>
            <Text className="text-[10px] text-gray-500 mt-0.5">
              프로필에 표시할 대표 자격증으로 설정해요.
            </Text>
          </View>
          <View
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              padding: 2,
              backgroundColor: isPrimary ? colors.brand[600] : "#E5E7EB",
              alignItems: isPrimary ? "flex-end" : "flex-start",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: "#fff",
              }}
            />
          </View>
        </Pressable>

        <Pressable
          onPress={onSave}
          disabled={submitting}
          className="bg-brand-600 p-4 rounded-2xl items-center mt-2"
        >
          {submitting ? (
            <ActivityIndicator color={colors.brand.fg} />
          ) : (
            <Text className="text-brand-fg font-black">등록</Text>
          )}
        </Pressable>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
