import { useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/src/store/auth-store";
import { KeyboardSafeScroll } from "@/src/components";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

export default function LoginScreen() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      showAlert("입력 확인", "이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      showAlert("로그인 실패", friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <KeyboardSafeScroll
        contentContainerStyle={{ justifyContent: "center", padding: 32 }}
      >
        <Text className="text-3xl font-black text-brand-700 mb-2 text-center">
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
            placeholder="비밀번호"
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
              <ActivityIndicator color={colors.brand.fg} />
            ) : (
              <Text className="text-brand-fg font-black">로그인</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password" as never)}
            disabled={submitting}
            className="items-center mt-1 py-1"
          >
            <Text className="text-xs text-gray-500">
              비밀번호를 잊으셨나요?{" "}
              <Text className="text-brand-700 font-black">재설정</Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/signup" as never)}
            disabled={submitting}
            className="items-center mt-1 py-2"
          >
            <Text className="text-xs text-gray-500">
              계정이 없나요?{" "}
              <Text className="text-brand-700 font-black">가입하기</Text>
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
