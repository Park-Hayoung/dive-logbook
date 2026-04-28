import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Users,
} from "lucide-react-native";

import { useTeams, useMyTeam } from "@/src/hooks/use-teams";
import { useAuthStore } from "@/src/store/auth-store";

export default function TeamListScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const [search, setSearch] = useState("");
  const { data: teams, isLoading } = useTeams(search);
  const { data: myTeam } = useMyTeam(userId);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row justify-between items-center border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base">팀 둘러보기</Text>
        <Pressable
          onPress={() => router.push("/team/new")}
          hitSlop={8}
          className="w-10 h-10 bg-brand-50 rounded-full items-center justify-center"
        >
          <Plus size={18} color="#2563EB" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {myTeam?.team ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/team/[id]",
                params: { id: myTeam.team!.id },
              })
            }
            className="bg-brand-600 p-5 rounded-3xl mb-4 flex-row items-center gap-3"
          >
            <View className="w-12 h-12 rounded-2xl bg-white/20 items-center justify-center">
              {myTeam.team.image_url ? (
                <Image
                  source={{ uri: myTeam.team.image_url }}
                  className="w-12 h-12 rounded-2xl"
                />
              ) : (
                <Users size={20} color="#fff" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[10px] text-brand-100 font-black uppercase">
                내 팀 · {myTeam.role === "leader" ? "리더" : "멤버"}
              </Text>
              <Text className="text-white font-black text-base">
                {myTeam.team.name}
              </Text>
            </View>
            <ChevronRight size={18} color="#fff" />
          </Pressable>
        ) : null}

        <View className="bg-white rounded-2xl border border-gray-200 px-4 mb-4 flex-row items-center gap-2">
          <Search size={14} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="팀 이름 검색"
            placeholderTextColor="#9CA3AF"
            className="flex-1 py-3 text-sm text-gray-900"
          />
        </View>

        {isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : !teams || teams.length === 0 ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs text-center">
              {search.trim()
                ? "검색 결과가 없습니다."
                : "아직 등록된 팀이 없습니다.\n첫 팀을 만들어보세요!"}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {teams.map((team) => (
              <Pressable
                key={team.id}
                onPress={() =>
                  router.push({
                    pathname: "/team/[id]",
                    params: { id: team.id },
                  })
                }
                className="bg-white p-4 rounded-3xl border border-gray-100 flex-row items-center gap-3 active:scale-95"
              >
                <View className="w-12 h-12 rounded-2xl bg-brand-50 items-center justify-center">
                  {team.imageUrl ? (
                    <Image
                      source={{ uri: team.imageUrl }}
                      className="w-12 h-12 rounded-2xl"
                    />
                  ) : (
                    <Users size={20} color="#2563EB" />
                  )}
                </View>
                <View className="flex-1 min-w-0">
                  <Text
                    className="font-black text-sm text-gray-900"
                    numberOfLines={1}
                  >
                    {team.name}
                  </Text>
                  <Text
                    className="text-[10px] text-gray-500 mt-0.5"
                    numberOfLines={1}
                  >
                    {team.description || "소개 없음"}
                  </Text>
                  <Text className="text-[10px] text-gray-400 mt-0.5">
                    멤버 {team.memberCount}명
                  </Text>
                </View>
                <ChevronRight size={16} color="#D1D5DB" />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
