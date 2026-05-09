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
import { ChevronLeft, Search as SearchIcon, Award } from "lucide-react-native";

import { useSearchProfiles } from "@/src/hooks/use-search";
import { useAuthStore } from "@/src/store/auth-store";

export default function SearchScreen() {
  const router = useRouter();
  const myUserId = useAuthStore((s) => s.user?.id);
  const [term, setTerm] = useState("");
  const { data: profiles, isLoading, error } = useSearchProfiles(term);

  const trimmed = term.trim();
  const showEmpty = trimmed.length === 0;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <View className="flex-1 bg-gray-100 rounded-2xl px-4 flex-row items-center gap-2">
          <SearchIcon size={14} color="#9CA3AF" />
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="다이버 닉네임 검색"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            className="flex-1 py-3 text-sm text-gray-900"
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {showEmpty ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <SearchIcon size={28} color="#D1D5DB" />
            <Text className="text-gray-400 text-xs mt-3">
              닉네임으로 다이버를 찾아보세요
            </Text>
          </View>
        ) : isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View className="bg-red-50 border border-red-100 p-4 rounded-2xl">
            <Text className="text-[10px] font-bold text-red-700">
              검색 실패
            </Text>
            <Text className="text-[10px] text-red-600 mt-1">
              {error instanceof Error ? error.message : "알 수 없는 오류"}
            </Text>
          </View>
        ) : !profiles || profiles.length === 0 ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs">
              검색 결과가 없어요.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            <Text className="text-[10px] font-black text-gray-400 uppercase mb-1 px-1">
              검색 결과 {profiles.length}
            </Text>
            {profiles.map((p) => {
              const isMe = p.id === myUserId;
              return (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    router.push({
                      pathname: "/profile/[id]",
                      params: { id: p.id },
                    })
                  }
                  className="bg-white p-3 rounded-2xl flex-row items-center gap-3 active:scale-95"
                >
                  <View className="w-11 h-11 rounded-full bg-brand-50 items-center justify-center">
                    {p.profileImageUrl ? (
                      <Image
                        source={{ uri: p.profileImageUrl }}
                        className="w-11 h-11 rounded-full"
                      />
                    ) : (
                      <Text className="text-base font-black text-brand-700">
                        {p.nickname.charAt(0)}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-1.5">
                      <Text
                        className="font-black text-sm text-gray-900"
                        numberOfLines={1}
                      >
                        {p.nickname}
                      </Text>
                      {isMe ? (
                        <Text className="text-[10px] text-gray-400">
                          (나)
                        </Text>
                      ) : null}
                    </View>
                    {p.certification || p.divingOrg ? (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Award size={10} color="#9CA3AF" />
                        <Text className="text-[10px] text-gray-500">
                          {[p.divingOrg, p.certification]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
