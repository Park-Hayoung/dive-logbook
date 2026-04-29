import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Plus,
  Anchor,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useUserEquipment,
  useDeleteUserEquipment,
  CATEGORY_LABEL,
  EQUIPMENT_CATEGORIES,
  displayName,
  type EquipmentCategory,
  type UserEquipment,
} from "@/src/hooks/use-equipment";
import { showAlert } from "@/src/lib/alert";
import { friendlyError } from "@/src/lib/error-messages";

export default function EquipmentListScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: items, isLoading } = useUserEquipment(userId);
  const del = useDeleteUserEquipment(userId);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (cat: EquipmentCategory) =>
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));

  // 카테고리별 그룹핑 — EQUIPMENT_CATEGORIES 순서 유지, 항목 있는 것만 노출.
  const groups = useMemo(() => {
    if (!items || items.length === 0) return [];
    const byCat = new Map<EquipmentCategory, UserEquipment[]>();
    for (const it of items) {
      const arr = byCat.get(it.category) ?? [];
      arr.push(it);
      byCat.set(it.category, arr);
    }
    return EQUIPMENT_CATEGORIES.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      items: byCat.get(c)!,
    }));
  }, [items]);

  const onEdit = (item: UserEquipment) => {
    router.push({
      pathname: "/equipment/register",
      params: { id: item.id },
    });
  };

  const onDelete = (item: UserEquipment) => {
    const { brand, model } = displayName(item);
    const label = `${brand} ${model}`.trim();
    showAlert("장비 삭제", `${label}를(을) 삭제할까요?\n다이브 기록의 장비 연결도 함께 해제돼요.`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await del.mutateAsync(item.id);
          } catch (err) {
            showAlert("삭제 실패", friendlyError(err));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="bg-white px-5 py-3 flex-row justify-between items-center border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="font-black text-base">장비 관리</Text>
        <Pressable
          onPress={() => router.push("/equipment/search")}
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
        {isLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : groups.length === 0 ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <Anchor size={32} color="#D1D5DB" />
            <Text className="text-gray-400 text-xs text-center mt-3 leading-5">
              아직 등록된 장비가 없어요.{"\n"}
              우상단 + 버튼으로 첫 장비를 추가해보세요.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {groups.map(({ category, items: catItems }) => {
              const isOpen = expanded[category] ?? false;
              return (
                <View
                  key={category}
                  className="bg-white rounded-3xl border border-gray-100 overflow-hidden"
                >
                  <Pressable
                    onPress={() => toggle(category)}
                    className="px-4 py-4 flex-row items-center gap-3 active:bg-gray-50"
                  >
                    <View className="w-10 h-10 rounded-2xl bg-brand-50 items-center justify-center">
                      <Anchor size={18} color="#2563EB" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="font-black text-sm text-gray-900">
                        {CATEGORY_LABEL[category] ?? category}
                      </Text>
                      <Text className="text-[11px] text-gray-500 mt-0.5">
                        {catItems.length}개
                      </Text>
                    </View>
                    {isOpen ? (
                      <ChevronDown size={20} color="#9CA3AF" />
                    ) : (
                      <ChevronRight size={20} color="#9CA3AF" />
                    )}
                  </Pressable>

                  {isOpen && (
                    <View className="border-t border-gray-100 bg-gray-50/40 px-3 py-3 gap-2">
                      {catItems.map((item) => {
                        const { brand, model } = displayName(item);
                        return (
                          <View
                            key={item.id}
                            className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3"
                          >
                            <View className="w-11 h-11 rounded-xl bg-brand-50 items-center justify-center overflow-hidden">
                              {item.photoUrl ? (
                                <Image
                                  source={{ uri: item.photoUrl }}
                                  className="w-11 h-11"
                                />
                              ) : (
                                <Anchor size={18} color="#2563EB" />
                              )}
                            </View>
                            <View className="flex-1 min-w-0">
                              <Text
                                className="font-black text-sm text-gray-900"
                                numberOfLines={1}
                              >
                                {brand}
                              </Text>
                              <Text
                                className="text-xs text-gray-500 mt-0.5"
                                numberOfLines={1}
                              >
                                {model}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => onEdit(item)}
                              hitSlop={8}
                              disabled={del.isPending}
                              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
                            >
                              <Pencil size={15} color="#374151" />
                            </Pressable>
                            <Pressable
                              onPress={() => onDelete(item)}
                              hitSlop={8}
                              disabled={del.isPending}
                              className="w-9 h-9 rounded-full bg-red-50 items-center justify-center"
                            >
                              <Trash2 size={15} color="#DC2626" />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
