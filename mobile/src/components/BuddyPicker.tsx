// 다이브 로그 작성 시 버디 선택 UI. EquipmentPicker 와 같은 패턴.
//   - 외부: 선택된 배지 줄 + "+ 추가" 버튼 (BuddyPickerField)
//   - 내부: 풀스크린 모달 — 검색, 보유 버디 리스트 (BuddyPickerModal)
// 버디는 기본적으로 user_buddies (단골 명단) 에서만 선택 — 신규 추가는 /buddies/add 에서.

import { useMemo, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, X, Search, User, UserPlus } from "lucide-react-native";
import {
  useSearchUsersByNickname,
  type BuddyProfile,
  type UserBuddy,
} from "@/src/hooks/use-buddies";

// ─────────────────────────────────────────────────────────────────────────────
// 외부: 배지 + "+ 추가" 버튼
// ─────────────────────────────────────────────────────────────────────────────
type FieldProps = {
  items: UserBuddy[];
  // 검색에서 새로 고른, 아직 user_buddies 에 등록 안 된 사용자 프로필.
  // 로그 저장 시점에 user_buddies INSERT 되며, 그 전까지 배지로 보여주기 위함.
  pendingProfiles?: BuddyProfile[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onOpenPicker: () => void;
  disabled?: boolean;
};

export function BuddyPickerField({
  items,
  pendingProfiles = [],
  selectedIds,
  onToggle,
  onOpenPicker,
  disabled,
}: FieldProps) {
  // items + pendingProfiles 합집합 (id 중복 시 items 우선) → selectedIds 로 필터.
  const byId = new Map<string, BuddyProfile>();
  for (const p of pendingProfiles) byId.set(p.id, p);
  for (const it of items) byId.set(it.id, it);
  const selected = Array.from(byId.values()).filter((it) =>
    selectedIds.has(it.id),
  );

  return (
    <View className="gap-2">
      <Text className="text-xs font-bold text-gray-700">
        함께한 버디 (선택)
      </Text>

      {selected.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {selected.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => !disabled && onToggle(it.id)}
              disabled={disabled}
              className="flex-row items-center gap-2 bg-brand-50 border border-brand-200 rounded-2xl pl-2 pr-2 py-1.5"
            >
              <Avatar uri={it.profileImageUrl} size={28} />
              <Text
                className="text-xs font-black text-gray-900 max-w-[140px]"
                numberOfLines={1}
              >
                {it.nickname}
              </Text>
              <View className="w-5 h-5 rounded-full bg-white items-center justify-center">
                <X size={11} color="#6B7280" />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={onOpenPicker}
        disabled={disabled}
        className="flex-row items-center justify-center gap-1.5 py-3 rounded-2xl border border-dashed border-gray-300 bg-white"
      >
        <Plus size={14} color="#6B7280" />
        <Text className="text-xs font-bold text-gray-600">
          {selected.length === 0 ? "버디 추가" : "버디 더 추가"}
        </Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 모달: 검색 + 리스트
// ─────────────────────────────────────────────────────────────────────────────
type ModalProps = {
  visible: boolean;
  onClose: () => void;
  items: UserBuddy[];
  selectedIds: Set<string>;
  onPick: (id: string) => void;
  onGoToManage?: () => void;
  // 닉네임 검색으로 새 회원을 골랐을 때 호출. 부모는 이 시점에 user_buddies 에 INSERT
  // 하지 않고, 선택만 누적해두었다가 "로그 저장" 시점에 일괄 처리한다.
  // currentUserId 가 함께 있어야 검색이 활성화됨.
  currentUserId?: string;
  onPickNew?: (profile: BuddyProfile) => void;
};

export function BuddyPickerModal({
  visible,
  onClose,
  items,
  selectedIds,
  onPick,
  onGoToManage,
  currentUserId,
  onPickNew,
}: ModalProps) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const trimmedLower = trimmed.toLowerCase();

  // 내 등록된 버디 중 닉네임 매칭.
  const filteredBuddies = useMemo(() => {
    if (!trimmedLower) return items;
    return items.filter((it) =>
      it.nickname.toLowerCase().includes(trimmedLower),
    );
  }, [items, trimmedLower]);

  // 검색 결과 (전 회원). 검색어 있을 때만 활성. 자기/이미 등록된 버디는 결과에서 제외.
  const buddyIds = useMemo(() => new Set(items.map((it) => it.id)), [items]);
  const searchEnabled = !!onPickNew && !!currentUserId && trimmed.length >= 1;
  const { data: searchResults, isFetching: searching } =
    useSearchUsersByNickname(searchEnabled ? trimmed : "", currentUserId);
  const newCandidates = useMemo<BuddyProfile[]>(() => {
    if (!searchEnabled) return [];
    return (searchResults ?? []).filter((p) => !buddyIds.has(p.id));
  }, [searchResults, buddyIds, searchEnabled]);

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handlePickNew = (profile: BuddyProfile) => {
    if (!onPickNew) return;
    onPickNew(profile);
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
              placeholder="닉네임으로 회원 검색"
              placeholderTextColor="#9CA3AF"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 py-3 text-sm text-gray-900"
            />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 내 버디 섹션 */}
          {items.length === 0 && !trimmed ? (
            <View className="bg-white p-8 rounded-3xl items-center">
              <Text className="text-gray-400 text-xs text-center leading-5">
                아직 등록된 버디가 없어요.{"\n"}
                위에서 닉네임으로 검색해 바로 추가하거나,{"\n"}
                설정 &gt; 버디 관리에서 등록할 수 있어요.
              </Text>
              {onGoToManage ? (
                <Pressable
                  onPress={() => {
                    onGoToManage();
                    handleClose();
                  }}
                  className="mt-4 bg-brand-600 px-4 py-2.5 rounded-2xl"
                >
                  <Text className="text-brand-fg text-xs font-black">
                    버디 관리 열기
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : items.length > 0 ? (
            <View className="gap-2">
              <Text className="text-[11px] font-black text-gray-500 uppercase px-1">
                내 버디
              </Text>
              {filteredBuddies.length === 0 ? (
                <View className="bg-white p-5 rounded-2xl">
                  <Text className="text-[11px] text-gray-400 text-center">
                    일치하는 등록 버디가 없어요.
                  </Text>
                </View>
              ) : (
                filteredBuddies.map((it) => {
                  const checked = selectedIds.has(it.id);
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
                      <Avatar uri={it.profileImageUrl} size={40} />
                      <View className="flex-1 min-w-0">
                        <Text
                          className="text-sm font-black text-gray-900"
                          numberOfLines={1}
                        >
                          {it.nickname}
                        </Text>
                        <Text
                          className="text-[11px] text-gray-500"
                          numberOfLines={1}
                        >
                          {it.lastDivedAt
                            ? `최근 ${it.lastDivedAt.slice(0, 10)} 함께 다이빙`
                            : "아직 함께한 다이브 없음"}
                        </Text>
                      </View>
                      {checked ? (
                        <View className="bg-brand-600 px-2 py-1 rounded-full">
                          <Text className="text-brand-fg text-[10px] font-black">
                            선택됨
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          ) : null}

          {/* 검색 결과 섹션 — 검색어 있을 때만 노출 */}
          {searchEnabled ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-1.5 px-1">
                <UserPlus size={12} color={colors.brand[700]} />
                <Text className="text-[11px] font-black text-gray-500 uppercase">
                  새로 추가 (전 회원)
                </Text>
              </View>
              {searching ? (
                <View className="bg-white p-5 rounded-2xl items-center">
                  <ActivityIndicator />
                </View>
              ) : newCandidates.length === 0 ? (
                <View className="bg-white p-5 rounded-2xl">
                  <Text className="text-[11px] text-gray-400 text-center">
                    일치하는 회원이 없어요.
                  </Text>
                </View>
              ) : (
                newCandidates.map((p) => {
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => handlePickNew(p)}
                      className="flex-row items-center gap-3 p-3 rounded-2xl border bg-white border-gray-200"
                    >
                      <Avatar uri={p.profileImageUrl} size={40} />
                      <View className="flex-1 min-w-0">
                        <Text
                          className="text-sm font-black text-gray-900"
                          numberOfLines={1}
                        >
                          {p.nickname}
                        </Text>
                        {p.divingOrg || p.certification ? (
                          <Text
                            className="text-[11px] text-gray-500"
                            numberOfLines={1}
                          >
                            {[p.divingOrg, p.certification]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        ) : null}
                      </View>
                      <View className="flex-row items-center gap-1 bg-brand-600 px-3 py-1.5 rounded-full">
                        <Plus size={12} color={colors.brand.fg} />
                        <Text className="text-[10px] font-black text-brand-fg">
                          선택
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Avatar({ uri, size }: { uri: string | null; size: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="bg-brand-50"
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-brand-50 items-center justify-center"
    >
      <User size={size * 0.5} color={colors.brand[700]} />
    </View>
  );
}
