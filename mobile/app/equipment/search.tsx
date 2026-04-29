import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Search, Anchor, PlusCircle } from "lucide-react-native";

import {
  useEquipmentSearch,
  CATEGORY_LABEL,
  EQUIPMENT_CATEGORIES,
} from "@/src/hooks/use-equipment";

export default function EquipmentSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const { data: results, isLoading, isFetching } = useEquipmentSearch(trimmed);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <View className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 px-4 flex-row items-center gap-2">
          <Search size={14} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="브랜드 또는 모델명 검색"
            placeholderTextColor="#9CA3AF"
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
        {trimmed.length === 0 ? (
          <CategoryShortcuts onPick={(cat) => goToRegisterEmpty(router, cat)} />
        ) : isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : !results || results.length === 0 ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Text className="text-gray-400 text-xs text-center leading-5">
              "{trimmed}" 검색 결과가 없어요.{"\n"}
              아래 버튼으로 직접 등록할 수 있어요.
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/equipment/register",
                  params: {
                    mode: "custom",
                    brand: trimmed,
                  },
                })
              }
              className="mt-4 bg-brand-600 px-5 py-3 rounded-2xl flex-row items-center gap-2"
            >
              <PlusCircle size={16} color="#fff" />
              <Text className="text-white font-black text-sm">
                "{trimmed}" 직접 등록
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-2">
            {isFetching ? (
              <View className="items-end mb-1">
                <ActivityIndicator size="small" />
              </View>
            ) : null}
            {results.map((r) => {
              const key =
                r.kind === "catalog"
                  ? `c:${r.id}`
                  : `b:${r.brand}:${r.category}`;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    if (r.kind === "catalog") {
                      router.push({
                        pathname: "/equipment/register",
                        params: {
                          mode: "catalog",
                          equipmentId: r.id,
                          brand: r.brand ?? "",
                          model: r.model,
                          category: r.category,
                        },
                      });
                    } else {
                      router.push({
                        pathname: "/equipment/register",
                        params: {
                          mode: "custom",
                          brand: r.brand,
                          category: r.category,
                        },
                      });
                    }
                  }}
                  className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-3 active:bg-gray-50"
                >
                  <View className="w-12 h-12 rounded-2xl bg-brand-50 items-center justify-center">
                    <Anchor size={20} color="#2563EB" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[10px] font-black text-brand-700 uppercase">
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </Text>
                    {r.kind === "catalog" ? (
                      <>
                        <Text
                          className="font-black text-sm text-gray-900 mt-0.5"
                          numberOfLines={1}
                        >
                          {r.brand ?? "—"}
                          {r.brandEn ? (
                            <Text className="text-xs font-normal text-gray-400">
                              {"  "}
                              {r.brandEn}
                            </Text>
                          ) : null}
                        </Text>
                        <Text
                          className="text-xs text-gray-500"
                          numberOfLines={1}
                        >
                          {r.model}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text
                          className="font-black text-sm text-gray-900 mt-0.5"
                          numberOfLines={1}
                        >
                          {r.brand}
                          {r.brandEn ? (
                            <Text className="text-xs font-normal text-gray-400">
                              {"  "}
                              {r.brandEn}
                            </Text>
                          ) : null}
                        </Text>
                        <Text className="text-xs text-gray-400">
                          모델명을 직접 입력하세요
                        </Text>
                      </>
                    )}
                  </View>
                  <View className="bg-brand-600 px-3 py-1.5 rounded-full">
                    <Text className="text-white text-[10px] font-black">
                      등록
                    </Text>
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

function goToRegisterEmpty(
  router: ReturnType<typeof useRouter>,
  category: string,
) {
  router.push({
    pathname: "/equipment/register",
    params: { mode: "custom", category },
  });
}

function CategoryShortcuts({ onPick }: { onPick: (cat: string) => void }) {
  return (
    <View>
      <Text className="text-[10px] font-black text-gray-400 uppercase mb-3 px-1">
        카테고리 선택으로 직접 등록할 수 있어요.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {EQUIPMENT_CATEGORIES.filter((c) => c !== "OTHER").map((c) => (
          <Pressable
            key={c}
            onPress={() => onPick(c)}
            className="bg-white border border-gray-200 px-4 py-3 rounded-2xl"
          >
            <Text className="text-xs font-bold text-gray-700">
              {CATEGORY_LABEL[c]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="text-[10px] text-gray-400 text-center mt-6 leading-4">
        검색이 우선이에요. 브랜드명을 입력하면{"\n"}
        등록 버튼이 같이 떠요.
      </Text>
    </View>
  );
}
