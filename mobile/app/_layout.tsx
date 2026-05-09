import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { queryClient } from "@/src/lib/query-client";
import { useAuthStore } from "@/src/store/auth-store";
import { useProfile } from "@/src/hooks/use-profile";
import { AlertHost } from "@/src/components/AlertHost";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Non-blocking: load font async — app renders immediately with system font,
  // then re-renders with KCC도담도담 when load completes. Avoids OOM/white-screen
  // if the font asset fails to load on dev builds.
  // Plugin (app.json: expo-font) embeds the font natively at build time.
  // useFonts here is a runtime fallback (e.g., after fast-refresh).
  // Used via inline `fontFamily: "KCCDodamdodam"` on the home tagline.
  // Note: combining this fontFamily with fontWeight (e.g. font-black) on
  // Android falls back to system font — keep weight unset on those Texts.
  useFonts({
    KCCDodamdodam: require("../assets/fonts/KCCDodamdodam.ttf"),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <RootGuard />
          <AlertHost />
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootGuard() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  const { data: profile, isFetched: isProfileFetched, isError: isProfileError } =
    useProfile(userId);
  const segments = useSegments();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return <View className="flex-1 bg-white" />;
  }

  const inAuthGroup = segments[0] === "(auth)";
  const onOnboarding = inAuthGroup && (segments as string[])[1] === "onboarding";

  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  // 세션은 있는데 프로필 쿼리가 아직 settle 안 됐으면 잠깐 빈 화면 — 이걸 안 하면
  // 네트워크 에러 등으로 profile === undefined 일 때 강제로 온보딩으로 튕긴다.
  if (session && !isProfileFetched && !isProfileError) {
    return <View className="flex-1 bg-white" />;
  }

  // 프로필이 정말로 없을 때만 (쿼리 성공 + null) 온보딩 강제. 에러일 땐 onboarding으로
  // 보내지 않고 현재 라우트(또는 로그인 화면)에 그대로 머물게 한다.
  if (session && isProfileFetched && !profile && !onOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (session && profile && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="log/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="log/[id]" />
      <Stack.Screen
        name="log/edit/[id]"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen name="feed/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="feed/[id]" />
      <Stack.Screen name="feed/edit/[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="schedule/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="profile/[id]" />
      <Stack.Screen name="profile/edit" options={{ presentation: "modal" }} />
      <Stack.Screen name="profile/cards/index" />
      <Stack.Screen name="profile/cards/capture" />
      <Stack.Screen name="profile/cards/add" options={{ presentation: "modal" }} />
      <Stack.Screen name="team/index" />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="team/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="search" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="map" />
      <Stack.Screen name="shop/search" />
      <Stack.Screen name="shop/[id]" />
      <Stack.Screen name="equipment/index" />
      <Stack.Screen name="equipment/search" />
      <Stack.Screen
        name="equipment/register"
        options={{ presentation: "modal" }}
      />
    </Stack>
  );
}
