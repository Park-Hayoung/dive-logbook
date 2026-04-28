import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/src/store/auth-store";
import { KeyboardSafeScroll } from "@/src/components";
import { validatePassword, isValidEmail } from "@/src/lib/password";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

type Step = "email" | "password" | "confirm";

export default function SignupScreen() {
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // When a field gains focus, wait for the keyboard to open then scroll to
  // the bottom so the rules / submit button remain visible above the keyboard.
  const onFieldFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 250);
  };

  const emailValid = isValidEmail(email);
  const checks = validatePassword(password);
  const confirmValid = confirm.length > 0 && password === confirm;

  const onNext = () => {
    if (step === "email" && emailValid) setStep("password");
    else if (step === "password" && checks.allPassed) setStep("confirm");
  };

  const onSubmit = async () => {
    if (!emailValid) {
      showAlert("이메일", "올바른 이메일 형식이 아니에요.");
      return;
    }
    if (!checks.allPassed) {
      showAlert("비밀번호", "비밀번호 조건을 모두 충족해주세요.");
      return;
    }
    if (!confirmValid) {
      showAlert("비밀번호 확인", "비밀번호가 일치하지 않아요.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email.trim(), password);
      // Route guard takes over from here.
    } catch (err: unknown) {
      showAlert("가입 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="px-5 py-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
      </View>

      <KeyboardSafeScroll
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        bottomPadding={240}
      >
        <Text className="text-3xl font-black text-gray-900 mb-2">
          가입하기
        </Text>
        <Text className="text-sm text-gray-500 mb-8">
          다이브 로그북 시작을 위한 정보를 입력해주세요.
        </Text>

        <ProgressDots step={step} />

        <View style={{ gap: 24, marginTop: 24 }}>
          {/* Email step */}
          <View className="gap-1.5">
            <Text className="text-xs font-bold text-gray-700">이메일</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              onFocus={onFieldFocus}
              placeholder="example@domain.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
            />
            {email.length > 0 && !emailValid ? (
              <Text className="text-[10px] text-red-500 mt-0.5">
                올바른 이메일 형식이 아니에요.
              </Text>
            ) : null}
          </View>

          {/* Password step */}
          {step !== "email" ? (
            <View className="gap-1.5">
              <Text className="text-xs font-bold text-gray-700">비밀번호</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={onFieldFocus}
                placeholder="비밀번호"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
                editable={!submitting}
                className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
              />
              <View className="gap-1 mt-1">
                <Rule label="8자 이상" passed={checks.minLength} />
                <Rule label="영문자 포함" passed={checks.hasLetter} />
                <Rule label="숫자 포함" passed={checks.hasNumber} />
                <Rule
                  label="특수문자 포함 (! @ # $ 등)"
                  passed={checks.hasSpecial}
                />
              </View>
            </View>
          ) : null}

          {/* Confirm step */}
          {step === "confirm" ? (
            <View className="gap-1.5">
              <Text className="text-xs font-bold text-gray-700">
                비밀번호 확인
              </Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                onFocus={onFieldFocus}
                placeholder="비밀번호 다시 입력"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
                editable={!submitting}
                className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
              />
              {confirm.length > 0 && !confirmValid ? (
                <Text className="text-[10px] text-red-500 mt-0.5">
                  비밀번호가 일치하지 않아요.
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View className="mt-8">
          {step === "confirm" ? (
            <Pressable
              onPress={onSubmit}
              disabled={submitting || !confirmValid}
              className={`p-4 rounded-2xl items-center ${
                confirmValid && !submitting ? "bg-brand-600" : "bg-gray-200"
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  className={`font-black ${
                    confirmValid ? "text-white" : "text-gray-400"
                  }`}
                >
                  가입하기
                </Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={onNext}
              disabled={
                (step === "email" && !emailValid) ||
                (step === "password" && !checks.allPassed)
              }
              className={`p-4 rounded-2xl items-center ${
                (step === "email" && emailValid) ||
                (step === "password" && checks.allPassed)
                  ? "bg-brand-600"
                  : "bg-gray-200"
              }`}
            >
              <Text
                className={`font-black ${
                  (step === "email" && emailValid) ||
                  (step === "password" && checks.allPassed)
                    ? "text-white"
                    : "text-gray-400"
                }`}
              >
                다음
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={() => router.replace("/(auth)/login")}
          disabled={submitting}
          className="items-center mt-3 py-2"
        >
          <Text className="text-xs text-gray-500">
            이미 계정이 있나요?{" "}
            <Text className="text-brand-700 font-black">로그인</Text>
          </Text>
        </Pressable>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}

function ProgressDots({ step }: { step: Step }) {
  const order: Step[] = ["email", "password", "confirm"];
  const currentIdx = order.indexOf(step);
  return (
    <View className="flex-row gap-1.5">
      {order.map((s, i) => (
        <View
          key={s}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 2,
            backgroundColor: i <= currentIdx ? "#2563EB" : "#E5E7EB",
          }}
        />
      ))}
    </View>
  );
}

function Rule({ label, passed }: { label: string; passed: boolean }) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: passed ? "#10B981" : "#E5E7EB",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {passed ? <Check size={10} color="#fff" strokeWidth={3} /> : null}
      </View>
      <Text
        className={`text-[10px] ${
          passed ? "text-emerald-700 font-bold" : "text-gray-400"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
