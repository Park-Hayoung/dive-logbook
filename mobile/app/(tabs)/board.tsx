import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pencil, MessagesSquare, Search, X } from "lucide-react-native";
import { useRouter } from "expo-router";

import { colors } from "@/src/lib/colors";
import {
  useBoardPosts,
  BOARD_CATEGORIES,
  type BoardCategoryFilter,
} from "@/src/hooks/use-board-posts";
import { BoardPostCard } from "@/src/components";

const FILTER_TABS: { value: BoardCategoryFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...BOARD_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

export default function BoardScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<BoardCategoryFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const { data: posts, isLoading, refetch, isRefetching } =
    useBoardPosts(category, submittedQuery);

  const submitSearch = () => setSubmittedQuery(searchInput.trim());
  const clearSearch = () => {
    setSearchInput("");
    setSubmittedQuery("");
  };

  const header = (
    <View>
      <View className="px-5 pt-2 pb-3">
        <Text className="text-2xl font-bold text-gray-900 mb-1">게시판</Text>
        <Text className="text-xs text-gray-500">
          다이버들과 자유롭게 이야기 나눠보세요
        </Text>
      </View>
      <View className="px-5 pb-2">
        <View className="flex-row items-center bg-white border border-gray-200 rounded-full pl-4 pr-2 h-11">
          <Pressable
            onPress={submitSearch}
            hitSlop={8}
            accessibilityLabel="검색"
          >
            <Search size={18} color="#6B7280" />
          </Pressable>
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder="제목, 내용, 작성자 검색"
            placeholderTextColor="#9CA3AF"
            className="flex-1 ml-2 mr-2 text-base text-gray-900"
          />
          {searchInput.length > 0 && (
            <Pressable
              onPress={clearSearch}
              hitSlop={8}
              accessibilityLabel="검색어 지우기"
              className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
            >
              <X size={14} color="#6B7280" />
            </Pressable>
          )}
        </View>
        {submittedQuery.length > 0 && (
          <View className="flex-row items-center mt-2">
            <Text className="text-xs text-gray-500">
              <Text className="font-bold text-gray-900">'{submittedQuery}'</Text> 검색 결과
            </Text>
          </View>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 8,
          gap: 6,
        }}
        className="bg-gray-50"
      >
        {FILTER_TABS.map((tab) => {
          const active = category === tab.value;
          return (
            <Pressable
              key={tab.value}
              onPress={() => setCategory(tab.value)}
              className={`px-3 py-1.5 rounded-full border ${
                active
                  ? "bg-gray-900 border-gray-900"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`text-[11px] font-black ${
                  active ? "text-white" : "text-gray-600"
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      {isLoading ? (
        <View className="flex-1">
          {header}
          <View className="bg-white py-12 items-center mt-px">
            <ActivityIndicator />
          </View>
        </View>
      ) : !posts || posts.length === 0 ? (
        <View className="flex-1">
          {header}
          <View className="bg-white py-16 items-center mt-px">
            <View className="w-14 h-14 rounded-3xl bg-brand-50 items-center justify-center mb-3">
              <MessagesSquare size={24} color="#0891B2" />
            </View>
            <Text className="text-xs font-bold text-gray-500 text-center">
              {submittedQuery
                ? `'${submittedQuery}' 검색 결과가 없어요`
                : category === "all"
                  ? "첫 글의 주인공이 되어보세요"
                  : `${FILTER_TABS.find((t) => t.value === category)?.label} 게시글이 없어요`}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          renderItem={({ item }) => (
            <BoardPostCard
              post={item}
              onPress={() =>
                router.push({
                  pathname: "/board/[id]",
                  params: { id: item.id },
                })
              }
            />
          )}
        />
      )}

      <Pressable
        onPress={() => router.push("/board/new")}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-brand-600 items-center justify-center shadow-lg active:scale-95"
        accessibilityLabel="새 글 작성"
      >
        <Pencil size={22} color={colors.brand.fg} />
      </Pressable>
    </SafeAreaView>
  );
}
