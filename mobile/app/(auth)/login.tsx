import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuthStore } from "@/src/store/auth-store";
import { KeyboardSafeScroll } from "@/src/components";

type Mode = "signIn" | "signUp";

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert("입력 확인", "이메일과 비밀번호를 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("비밀번호", "최소 6자 이상이어야 합니다.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signUp") {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      Alert.alert(mode === "signUp" ? "가입 실패" : "로그인 실패", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <KeyboardSafeScroll
        contentContainerStyle={{ justifyContent: "center", padding: 32 }}
      >
        <Text className="text-3xl font-black text-brand-600 mb-2 text-center">
          DiveLog
        </Text>
        <Text className="text-sm text-gray-500 mb-12 text-center">
          다이버를 위한 로그북 + 커뮤니티
        </Text>

        <View className="w-full gap-3">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="이메일"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호 (6자 이상)"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            autoCapitalize="none"
            editable={!submitting}
            className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
          />

          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            className="bg-brand-600 p-4 rounded-2xl items-center mt-2"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-black">
                {mode === "signUp" ? "가입하기" : "로그인"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setMode(mode === "signUp" ? "signIn" : "signUp")}
            disabled={submitting}
            className="items-center mt-2"
          >
            <Text className="text-xs text-gray-500">
              {mode === "signUp"
                ? "이미 계정이 있나요? 로그인"
                : "계정이 없나요? 가입하기"}
            </Text>
          </Pressable>
        </View>

        <Text className="text-[10px] text-gray-300 mt-12 text-center">
          소셜 로그인 (카카오/Google/Apple)은 V1.1
        </Text>
      </KeyboardSafeScroll>
    </View>
  );
}
