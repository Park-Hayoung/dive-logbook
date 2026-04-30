// 비밀번호 재설정 — Supabase resetPasswordForEmail.
// 이메일 = 로그인 ID 이므로 별도의 "ID 찾기" 흐름은 없음 (이메일 자체가 ID).
// Supabase 에서 메일을 보내고, 사용자가 메일 링크 클릭 → 앱 deep link 로 복귀하면
// 그 시점부터 임시 세션이 활성. 거기서 새 비밀번호로 updateUser 호출.

import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, MailCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { supabase } from "@/src/services/supabase";
import { KeyboardSafeScroll } from "@/src/components";
import { isValidEmail } from "@/src/lib/password";
import { friendlyError } from "@/src/lib/error-messages";
import { showAlert } from "@/src/lib/alert";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const emailValid = isValidEmail(email);

  const onSubmit = async () => {
    if (!emailValid) {
      showAlert("이메일", "올바른 이메일 형식이 아니에요.");
      return;
    }
    setSubmitting(true);
    try {
      const redirectTo = Linking.createURL("/reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      showAlert("재설정 메일 전송 실패", friendlyError(err));
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
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
      >
        <Text className="text-3xl font-black text-gray-900 mb-2">
          비밀번호 재설정
        </Text>
        <Text className="text-sm text-gray-500 mb-8">
          가입한 이메일로 재설정 링크를 보내드려요.
        </Text>

        {sent ? (
          <View className="bg-emerald-50 p-5 rounded-3xl gap-2 items-center mb-6">
            <View className="w-12 h-12 rounded-full bg-emerald-100 items-center justify-center mb-1">
              <MailCheck size={22} color="#059669" />
            </View>
            <Text className="text-base font-black text-emerald-800">
              메일을 보냈어요
            </Text>
            <Text className="text-xs text-emerald-700 text-center leading-5">
              {email}{"\n"}
              메일함을 확인하고 링크를 눌러 새 비밀번호를 설정해주세요.
              {"\n"}몇 분 내에 도착하지 않으면 스팸함을 확인해주세요.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            <Text className="text-xs font-bold text-gray-700">이메일</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="가입한 이메일"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900"
            />
            {email.length > 0 && !emailValid ? (
              <Text className="text-[10px] text-red-500">
                올바른 이메일 형식이 아니에요.
              </Text>
            ) : null}
          </View>
        )}

        {sent ? (
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            className="bg-brand-600 p-4 rounded-2xl items-center mt-2"
          >
            <Text className="text-white font-black">로그인 화면으로</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onSubmit}
            disabled={submitting || !emailValid}
            className={`p-4 rounded-2xl items-center mt-6 ${
              emailValid && !submitting ? "bg-brand-600" : "bg-gray-200"
            }`}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-black ${
                  emailValid ? "text-white" : "text-gray-400"
                }`}
              >
                재설정 링크 보내기
              </Text>
            )}
          </Pressable>
        )}

        <View className="mt-6 p-4 bg-gray-50 rounded-2xl">
          <Text className="text-[10px] font-black text-gray-700 mb-1">
            💡 이메일이 곧 로그인 아이디예요
          </Text>
          <Text className="text-[10px] text-gray-500 leading-4">
            {`DiveLog 는 별도의 아이디 없이 가입 시 입력한 이메일로 로그인합니다. 이메일을 잊으셨다면 가입 시 사용한 메일함에서 "DiveLog" 또는 "Supabase" 로 검색해보세요.`}
          </Text>
        </View>
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}
