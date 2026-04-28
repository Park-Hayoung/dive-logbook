import { Tabs, useRouter } from "expo-router";
import { Home, Globe, Book, User, Plus } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { colors } from "@/src/lib/colors";

export default function TabLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.text.muted,
        headerShown: false,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 0,
          backgroundColor: "rgba(255,255,255,0.95)",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "피드",
          tabBarIcon: ({ color, size }) => <Globe color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="new-log-action"
        options={{
          title: "",
          tabBarButton: () => (
            <View className="flex-1 items-center justify-center">
              <Pressable
                onPress={() => router.push("/log/new")}
                className="w-14 h-14 rounded-full bg-brand-600 items-center justify-center -mt-6 shadow-lg active:scale-95"
                accessibilityLabel="새 로그 기록"
              >
                <Plus color="#fff" size={28} strokeWidth={3} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="logbook"
        options={{
          title: "로그북",
          tabBarIcon: ({ color, size }) => <Book color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "프로필",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
