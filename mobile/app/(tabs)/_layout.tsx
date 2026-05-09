import { Tabs, useRouter } from "expo-router";
import {
  Home,
  Globe,
  Book,
  User,
  Plus,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text, View, Platform } from "react-native";

import { colors } from "@/src/lib/colors";

type TabIconProps = {
  Icon: LucideIcon;
  label: string;
  focused: boolean;
};

function TabItem({ Icon, label, focused }: TabIconProps) {
  return (
    <View className="flex-1 items-center justify-center" style={{ gap: 2 }}>
      <View
        style={{
          width: 56,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? colors.brand[50] : "transparent",
        }}
      >
        <Icon
          color={focused ? colors.brand[700] : colors.text.muted}
          size={20}
          strokeWidth={focused ? 2.5 : 2}
        />
      </View>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? "900" : "600",
          color: focused ? colors.brand[700] : colors.text.muted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 76,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: "#F3F4F6",
          backgroundColor: "#FFFFFF",
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: -2 },
            },
            android: {
              elevation: 8,
            },
          }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={Home} label="홈" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={Globe} label="피드" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="new-log-action"
        options={{
          tabBarButton: () => (
            <View className="flex-1 items-center justify-center">
              <Pressable
                onPress={() => router.push("/log/new")}
                accessibilityLabel="새 로그 기록"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.brand[600],
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -22,
                  borderWidth: 4,
                  borderColor: "#FFFFFF",
                  ...Platform.select({
                    ios: {
                      shadowColor: colors.brand[600],
                      shadowOpacity: 0.35,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 6 },
                    },
                    android: {
                      elevation: 8,
                    },
                  }),
                }}
                className="active:scale-95"
              >
                <Plus color={colors.brand.fg} size={26} strokeWidth={3} />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="logbook"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={Book} label="로그북" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem Icon={User} label="프로필" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
