import { useEffect, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Shuffle } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/src/store/auth-store";
import { supabase } from "@/src/services/supabase";
import { KeyboardSafeScroll } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";
import { randomNickname } from "@/src/lib/nickname-generator";

const CERTIFICATIONS = [
  "Open Water",
  "Advanced",
  "Rescue",
  "Divemaster",
  "Instructor",
] as const;

// Major recreational + technical diving organizations.
// PADI/SSI lead globally; KUDA is the local Korean federation.
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

type Cert = (typeof CERTIFICATIONS)[number];
type Org = (typeof ORGS)[number];

export default function OnboardingScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [nickname, setNickname] = useState("");
  const [certification, setCertification] = useState<Cert>("Open Water");
  const [divingOrg, setDivingOrg] = useState<Org>("PADI");
  const [totalDives, setTotalDives] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill a fun nickname suggestion on first mount. The user can keep it,
  // shuffle for a new one, or type their own.
  useEffect(() => {
    setNickname(randomNickname());
  }, []);

  const onShuffleNickname = () => setNickname(randomNickname());

  const onSubmit = async () => {
    if (!user) {
      showAlert("오류", "로그인 세션이 없어요.");
      return;
    }
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      showAlert("닉네임", "최소 2자 이상이어야 해요.");
      return;
    }
    const dives = Number.parseInt(totalDives, 10);
    if (Number.isNaN(dives) || dives < 0) {
      showAlert("누적 다이브", "0 이상의 숫자를 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        nickname: trimmed,
        certification,
        diving_org: divingOrg,
        total_dives_at_signup: dives,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (err: unknown) {
      showAlert("프로필 생성 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <KeyboardSafeScroll contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text className="text-2xl font-black mb-2">프로필 설정</Text>
        <Text className="text-sm text-gray-500 mb-4">
          로그북 시작을 위한 기본 정보예요.
        </Text>

        <View className="gap-1.5">
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-bold text-gray-700">닉네임</Text>
            <Pressable
              onPress={onShuffleNickname}
              disabled={submitting}
              hitSlop={6}
              className="flex-row items-center gap-1 bg-brand-50 px-2.5 py-1 rounded-full"
            >
              <Shuffle size={11} color={colors.brand[700]} />
              <Text className="text-[10px] font-black text-brand-700">
                자동 생성
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="예: 푸른돌고래"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />
          <Text className="text-[10px] text-gray-400 mt-0.5">
            마음에 드는 닉네임이 나올 때까지 자동 생성을 눌러보세요.
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">자격등급</Text>
          <View className="flex-row flex-wrap gap-2">
            {CERTIFICATIONS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCertification(c)}
                disabled={submitting}
                className={`px-3 py-2 rounded-xl border ${
                  certification === c
                    ? "bg-brand-600 border-brand-600"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    certification === c ? "text-brand-fg" : "text-gray-700"
                  }`}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">다이빙 단체</Text>
          <View className="flex-row flex-wrap gap-2">
            {ORGS.map((o) => (
              <Pressable
                key={o}
                onPress={() => setDivingOrg(o)}
                disabled={submitting}
                className={`px-3 py-2 rounded-xl border ${
                  divingOrg === o
                    ? "bg-brand-600 border-brand-600"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    divingOrg === o ? "text-brand-fg" : "text-gray-700"
                  }`}
                >
                  {o}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-1">
          <Text className="text-xs font-bold text-gray-700">
            누적 다이브 횟수
          </Text>
          <TextInput
            value={totalDives}
            onChangeText={setTotalDives}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className="bg-brand-600 p-4 rounded-2xl items-center mt-4"
        >
          {submitting ? (
            <ActivityIndicator color={colors.brand.fg} />
          ) : (
            <Text className="text-brand-fg font-black">시작하기</Text>
          )}
        </Pressable>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
