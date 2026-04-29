// 다이브 로그 작성 시 사용 장비 선택 UI.
//   - 외부: 선택된 배지 줄 + "+ 추가" 버튼 (EquipmentPickerField)
//   - 내부: 풀스크린 모달 — 검색, 카테고리 필터, 보유 장비 리스트,
//          매칭 0개 시 "직접 추가" CTA (EquipmentPickerModal)
//
// 보유 장비가 100+개라도 검색으로 빠르게 찾도록 설계.

import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, X, Search, Anchor } from "lucide-react-native";

import {
  CATEGORY_LABEL,
  EQUIPMENT_CATEGORIES,
  displayName,
  type EquipmentCategory,
  type UserEquipment,
} from "@/src/hooks/use-equipment";

// ─────────────────────────────────────────────────────────────────────────────
// 외부: 배지 + "+ 추가" 버튼
// ─────────────────────────────────────────────────────────────────────────────
type FieldProps = {
  items: UserEquipment[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onOpenPicker: () => void;
  disabled?: boolean;
};

export function EquipmentPickerField({
  items,
  selectedIds,
  onToggle,
  onOpenPicker,
  disabled,
}: FieldProps) {
  const selected = items.filter((it) => selectedIds.has(it.id));

  return (
    <View className="gap-2">
      <Text className="text-xs font-bold text-gray-700">사용한 장비 (선택)</Text>

      {selected.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {selected.map((it) => {
            const { brand, model } = displayName(it);
            return (
              <Pressable
                key={it.id}
                onPress={() => !disabled && onToggle(it.id)}
                disabled={disabled}
                className="flex-row items-center gap-2 bg-brand-50 border border-brand-200 rounded-2xl pl-3 pr-2 py-2"
              >
                <View className="w-7 h-7 rounded-lg bg-white items-center justify-center">
                  <Anchor size={14} color="#2563EB" />
                </View>
                <View>
                  <Text className="text-[9px] font-black text-brand-700 uppercase">
                    {CATEGORY_LABEL[it.category] ?? it.category}
                  </Text>
                  <Text
                    className="text-xs font-black text-gray-900 max-w-[180px]"
                    numberOfLines={1}
                  >
                    {brand} {model}
                  </Text>
                </View>
                <View className="w-6 h-6 rounded-full bg-white items-center justify-center ml-1">
                  <X size={12} color="#6B7280" />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        onPress={onOpenPicker}
        disabled={disabled}
        className="flex-row items-center justify-center gap-1.5 py-3 rounded-2xl border border-dashed border-gray-300 bg-white"
      >
        <Plus size={14} color="#6B7280" />
        <Text className="text-xs font-bold text-gray-600">
          {selected.length === 0 ? "장비 추가" : "장비 더 추가"}
        </Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 모달: 검색 + 카테고리 필터 + 리스트 + 직접 추가
// ─────────────────────────────────────────────────────────────────────────────
type ModalProps = {
  visible: boolean;
  onClose: () => void;
  items: UserEquipment[];
  selectedIds: Set<string>;
  onPick: (id: string) => void;
  onCreateInline: (input: {
    brand: string;
    model: string;
    category: EquipmentCategory;
  }) => Promise<void>;
  creating: boolean;
};

export function EquipmentPickerModal({
  visible,
  onClose,
  items,
  selectedIds,
  onPick,
  onCreateInline,
  creating,
}: ModalProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | null>(
    null,
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState<EquipmentCategory>("BCD");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");

  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (categoryFilter && it.category !== categoryFilter) return false;
      if (!trimmed) return true;
      const { brand, model } = displayName(it);
      const brandEn = it.catalog?.brandEn ?? "";
      const hay = `${brand} ${model} ${brandEn}`.toLowerCase();
      // 멀티 토큰 — 모든 토큰이 hay 안에 있어야 매칭
      return trimmed
        .split(/\s+/)
        .filter(Boolean)
        .every((tok) => hay.includes(tok));
    });
  }, [items, trimmed, categoryFilter]);

  const handleClose = () => {
    setQuery("");
    setCategoryFilter(null);
    setShowAddForm(false);
    setNewBrand("");
    setNewModel("");
    onClose();
  };

  const handleConfirmCreate = async () => {
    const brand = newBrand.trim();
    const model = newModel.trim();
    if (!brand || !model) return;
    await onCreateInline({ brand, model, category: newCategory });
    setNewBrand("");
    setNewModel("");
    setShowAddForm(false);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
        <View className="bg-white px-5 py-3 flex-row items-center gap-3 border-b border-gray-100">
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
          >
            <X size={20} color="#374151" />
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

        {/* 카테고리 필터 칩 */}
        <View className="bg-white border-b border-gray-100 py-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
          >
            <CategoryChip
              label="전체"
              active={categoryFilter === null}
              onPress={() => setCategoryFilter(null)}
            />
            {EQUIPMENT_CATEGORIES.map((c) => (
              <CategoryChip
                key={c}
                label={CATEGORY_LABEL[c]}
                active={categoryFilter === c}
                onPress={() => setCategoryFilter(c)}
              />
            ))}
          </ScrollView>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.length === 0 ? (
            <View className="bg-white p-8 rounded-3xl items-center">
              <Text className="text-gray-400 text-xs text-center leading-5">
                {trimmed || categoryFilter
                  ? "조건에 맞는 보유 장비가 없어요."
                  : "아직 등록된 장비가 없어요."}
                {"\n"}
                아래 버튼으로 직접 추가할 수 있어요.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {filtered.map((it) => {
                const checked = selectedIds.has(it.id);
                const { brand, model } = displayName(it);
                return (
                  <Pressable
                    key={it.id}
                    onPress={() => {
                      onPick(it.id);
                      handleClose();
                    }}
                    className={`flex-row items-center gap-3 p-3 rounded-2xl border ${
                      checked
                        ? "bg-brand-50 border-brand-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <View className="w-10 h-10 rounded-xl bg-brand-50 items-center justify-center">
                      <Anchor size={18} color="#2563EB" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-[10px] font-black text-brand-700 uppercase">
                        {CATEGORY_LABEL[it.category] ?? it.category}
                      </Text>
                      <Text
                        className="text-sm font-black text-gray-900"
                        numberOfLines={1}
                      >
                        {brand}
                      </Text>
                      <Text
                        className="text-[11px] text-gray-500"
                        numberOfLines={1}
                      >
                        {model}
                      </Text>
                    </View>
                    {checked ? (
                      <View className="bg-brand-600 px-2 py-1 rounded-full">
                        <Text className="text-white text-[10px] font-black">
                          선택됨
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* 하단: 직접 추가 영역 */}
        {showAddForm ? (
          <View className="bg-white p-4 border-t border-gray-200 gap-3">
            <Text className="text-[10px] font-black text-brand-700 uppercase">
              새 장비 직접 추가
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-1.5">
                {EQUIPMENT_CATEGORIES.map((c) => {
                  const active = newCategory === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setNewCategory(c)}
                      disabled={creating}
                      className={`px-3 py-2 rounded-xl border ${
                        active
                          ? "bg-brand-600 border-brand-600"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-black ${
                          active ? "text-white" : "text-gray-700"
                        }`}
                      >
                        {CATEGORY_LABEL[c]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View className="flex-row gap-2">
              <TextInput
                value={newBrand}
                onChangeText={setNewBrand}
                placeholder="브랜드"
                placeholderTextColor="#9CA3AF"
                editable={!creating}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white"
              />
              <TextInput
                value={newModel}
                onChangeText={setNewModel}
                placeholder="모델명"
                placeholderTextColor="#9CA3AF"
                editable={!creating}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white"
              />
            </View>

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setShowAddForm(false)}
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 items-center"
              >
                <Text className="text-xs font-black text-gray-700">취소</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmCreate}
                disabled={creating || !newBrand.trim() || !newModel.trim()}
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  !newBrand.trim() || !newModel.trim()
                    ? "bg-brand-300"
                    : "bg-brand-600"
                }`}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-xs font-black text-white">
                    추가하고 선택
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setShowAddForm(true);
              // 검색어가 있으면 그것을 브랜드 prefill
              if (trimmed && !newBrand) setNewBrand(query.trim());
              // 카테고리 필터가 있으면 그것을 prefill
              if (categoryFilter) setNewCategory(categoryFilter);
            }}
            className="bg-white p-4 border-t border-gray-200 flex-row items-center justify-center gap-1.5"
          >
            <Plus size={14} color="#2563EB" />
            <Text className="text-xs font-black text-brand-700">
              {query.trim()
                ? `"${query.trim()}" 직접 추가`
                : "장비 직접 추가"}
            </Text>
          </Pressable>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-3 py-1.5 rounded-full border ${
        active
          ? "bg-brand-600 border-brand-600"
          : "bg-white border-gray-200"
      }`}
    >
      <Text
        className={`text-[11px] font-black ${
          active ? "text-white" : "text-gray-700"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
