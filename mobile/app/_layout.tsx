import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
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
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <RootGuard />
        <AlertHost />
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootGuard() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  const { data: profile, isLoading: isProfileLoading } = useProfile(userId);
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

  if (session && !profile && !isProfileLoading && !onOnboarding) {
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
      <Stack.Screen name="feed/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="feed/[id]" />
      <Stack.Screen name="feed/edit/[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="schedule/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="profile/[id]" />
      <Stack.Screen name="profile/edit" options={{ presentation: "modal" }} />
      <Stack.Screen name="team/index" />
      <Stack.Screen name="team/[id]" />
      <Stack.Screen name="team/new" options={{ presentation: "modal" }} />
      <Stack.Screen name="search" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="shop/search" />
      <Stack.Screen name="shop/[id]" />
    </Stack>
  );
}
