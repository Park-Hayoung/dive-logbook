import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Anchor,
  UserCog,
  LogOut,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import { useProfile } from "@/src/hooks/use-profile";
import { useMyTeam } from "@/src/hooks/use-teams";

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const userId = user?.id;

  const { data: profile } = useProfile(userId);
  const { data: myTeam } = useMyTeam(userId);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base flex-1">설정</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text className="text-[10px] font-black text-gray-400 uppercase mb-2 px-1">
          계정
        </Text>

        <Pressable
          onPress={() => router.push("/profile/edit" as never)}
          className="bg-white p-4 rounded-2xl flex-row items-center gap-3 mb-2"
        >
          <View className="w-10 h-10 rounded-2xl bg-brand-50 items-center justify-center">
            <UserCog size={18} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="font-black text-sm text-gray-900">프로필 편집</Text>
            <Text className="text-[10px] text-gray-500">
              {profile?.nickname ?? "닉네임"} · {user?.email}
            </Text>
          </View>
          <ChevronRight size={16} color="#D1D5DB" />
        </Pressable>

        <Text className="text-[10px] font-black text-gray-400 uppercase mt-4 mb-2 px-1">
          활동 관리
        </Text>

        {myTeam?.team ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/team/[id]",
                params: { id: myTeam.team!.id },
              })
            }
            className="bg-white p-4 rounded-2xl flex-row items-center gap-3 mb-2"
          >
            <View className="w-10 h-10 rounded-2xl bg-brand-50 items-center justify-center">
              <Users size={18} color="#2563EB" />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-black text-gray-400 uppercase">
                내 팀 · {myTeam.role === "leader" ? "리더" : "멤버"}
              </Text>
              <Text className="font-black text-sm text-gray-900">
                {myTeam.team.name}
              </Text>
            </View>
            <ChevronRight size={16} color="#D1D5DB" />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push("/team" as never)}
            className="bg-white p-4 rounded-2xl flex-row items-center gap-3 mb-2"
          >
            <View className="w-10 h-10 rounded-2xl bg-gray-100 items-center justify-center">
              <Users size={18} color="#6B7280" />
            </View>
            <View className="flex-1">
              <Text className="font-black text-sm text-gray-900">팀 둘러보기</Text>
              <Text className="text-[10px] text-gray-500">
                다이빙 팀에 가입하거나 직접 만들어보세요
              </Text>
            </View>
            <ChevronRight size={16} color="#D1D5DB" />
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push("/equipment" as never)}
          className="bg-white p-4 rounded-2xl flex-row items-center gap-3 mb-2"
        >
          <View className="w-10 h-10 rounded-2xl bg-brand-50 items-center justify-center">
            <Anchor size={18} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="font-black text-sm text-gray-900">장비 관리</Text>
            <Text className="text-[10px] text-gray-500">
              보유 다이빙 장비를 등록하고 관리해요
            </Text>
          </View>
          <ChevronRight size={16} color="#D1D5DB" />
        </Pressable>

        <Pressable
          onPress={signOut}
          className="bg-white p-4 rounded-2xl flex-row items-center gap-3 mt-4"
        >
          <View className="w-10 h-10 rounded-2xl bg-red-50 items-center justify-center">
            <LogOut size={18} color="#DC2626" />
          </View>
          <Text className="font-black text-sm text-red-600 flex-1">로그아웃</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
