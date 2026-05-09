import { useEffect, useState } from "react";
import { colors } from "@/src/lib/colors";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X } from "lucide-react-native";

import { useAuthStore } from "@/src/store/auth-store";
import {
  useRegisterEquipment,
  useUpdateUserEquipment,
  useUserEquipmentItem,
  EQUIPMENT_CATEGORIES,
  CATEGORY_LABEL,
  displayName,
  type EquipmentCategory,
} from "@/src/hooks/use-equipment";
import { KeyboardSafeScroll, DateField, dateToYmd } from "@/src/components";
import { showAlert } from "@/src/lib/alert";
import { friendlyError } from "@/src/lib/error-messages";

type Params = {
  // 신규 등록용
  mode?: "catalog" | "custom";
  equipmentId?: string;
  brand?: string;
  model?: string;
  category?: string;
  // 수정용 — 있으면 해당 user_equipment 를 프리필.
  id?: string;
};

const isValidCategory = (v: string | undefined): v is EquipmentCategory =>
  !!v && (EQUIPMENT_CATEGORIES as readonly string[]).includes(v);

const ymdToDate = (s: string | null): Date | null => {
  if (!s) return null;
  // "YYYY-MM-DD" — 로컬 자정으로 해석되도록 분해 파싱 (UTC shift 회피)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export default function RegisterEquipmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const userId = useAuthStore((s) => s.user?.id);

  const editId = typeof params.id === "string" ? params.id : "";
  const isEdit = !!editId;

  const register = useRegisterEquipment(userId);
  const update = useUpdateUserEquipment(userId);
  const { data: existing, isLoading: existingLoading } = useUserEquipmentItem(
    isEdit ? editId : undefined,
  );

  const mode: "catalog" | "custom" = params.mode === "catalog" ? "catalog" : "custom";
  const equipmentId = typeof params.equipmentId === "string" ? params.equipmentId : "";
  const presetBrand = typeof params.brand === "string" ? params.brand : "";
  const presetModel = typeof params.model === "string" ? params.model : "";
  // 검색/카탈로그/카테고리 카드 등 진입 시 카테고리가 정해져 있으면 락 — picker 대신
  // 한 줄 표시. "검색결과 없음 → 직접 등록" 진입은 카테고리 미지정 → picker 노출.
  // 수정 모드에서는 항상 picker 노출 (사용자가 카테고리 변경 가능).
  const hasPresetCategory =
    !isEdit &&
    isValidCategory(typeof params.category === "string" ? params.category : undefined);
  const presetCategory: EquipmentCategory = hasPresetCategory
    ? (params.category as EquipmentCategory)
    : "OTHER";

  const [brand, setBrand] = useState(presetBrand);
  const [model, setModel] = useState(presetModel);
  const [category, setCategory] = useState<EquipmentCategory>(presetCategory);
  const [serialNo, setSerialNo] = useState("");
  const [purchasedAt, setPurchasedAt] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // 수정 모드: 기존 항목 fetch 완료 시 폼 1회 프리필.
  useEffect(() => {
    if (!isEdit || !existing || prefilled) return;
    const { brand: b, model: m } = displayName(existing);
    setBrand(existing.customBrand ?? b ?? "");
    setModel(existing.customModel ?? m ?? "");
    setCategory(existing.category);
    setSerialNo(existing.serialNo ?? "");
    setPurchasedAt(ymdToDate(existing.purchasedAt));
    setNotes(existing.notes ?? "");
    setPrefilled(true);
  }, [isEdit, existing, prefilled]);

  // 수정 모드에서 카탈로그 항목 여부는 기존 레코드의 equipment_id 기준.
  const isCatalog = isEdit
    ? !!existing?.equipmentId
    : mode === "catalog" && !!equipmentId;

  // 수정 화면에서 카탈로그 항목의 표시용 brand/model — 기존 레코드 join.
  const catalogDisplay = isEdit
    ? existing
      ? displayName(existing)
      : { brand: "", model: "" }
    : { brand: presetBrand, model: presetModel };

  const onSubmit = async () => {
    if (!userId) {
      showAlert("오류", "로그인 세션이 없어요.");
      return;
    }

    try {
      if (isEdit) {
        const trimmedBrand = brand.trim();
        const trimmedModel = model.trim();
        if (!isCatalog && (!trimmedBrand || !trimmedModel)) {
          showAlert("필수 항목", "브랜드와 모델명을 입력해주세요.");
          return;
        }
        await update.mutateAsync({
          id: editId,
          patch: {
            category,
            serialNo: serialNo.trim() || null,
            purchasedAt: purchasedAt ? dateToYmd(purchasedAt) : null,
            notes: notes.trim() || null,
            // custom 항목만 brand/model 수정 — 카탈로그 항목은 변경 없이 두기 위해 미전달.
            ...(isCatalog
              ? {}
              : {
                  customBrand: trimmedBrand,
                  customModel: trimmedModel,
                }),
          },
        });
        router.back();
        return;
      }

      if (isCatalog) {
        await register.mutateAsync({
          kind: "catalog",
          equipmentId,
          category,
          serialNo: serialNo.trim() || null,
          purchasedAt: purchasedAt ? dateToYmd(purchasedAt) : null,
          notes: notes.trim() || null,
        });
      } else {
        const trimmedBrand = brand.trim();
        const trimmedModel = model.trim();
        if (!trimmedBrand || !trimmedModel) {
          showAlert("필수 항목", "브랜드와 모델명을 입력해주세요.");
          return;
        }
        await register.mutateAsync({
          kind: "custom",
          brand: trimmedBrand,
          model: trimmedModel,
          category,
          serialNo: serialNo.trim() || null,
          purchasedAt: purchasedAt ? dateToYmd(purchasedAt) : null,
          notes: notes.trim() || null,
        });
      }
      // 등록 성공 시 search 화면도 닫고 list 로 — pop 두 번
      router.dismissTo("/equipment" as never);
    } catch (err) {
      showAlert(isEdit ? "수정 실패" : "등록 실패", friendlyError(err));
    }
  };

  const submitting = register.isPending || update.isPending;
  const showLoading = isEdit && existingLoading && !prefilled;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <KeyboardSafeScroll
        contentContainerStyle={{ padding: 20, gap: 16 }}
        bottomPadding={120}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text style={{ fontFamily: "KCCDodamdodam" }} className="text-2xl font-title text-gray-900">
            {isEdit ? "장비 수정" : "장비 등록"}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="p-2 bg-gray-100 rounded-full"
            disabled={submitting}
          >
            <X size={20} color="#374151" />
          </Pressable>
        </View>

        {showLoading ? (
          <View className="bg-white p-8 rounded-3xl items-center">
            <ActivityIndicator />
          </View>
        ) : (
          <>
            {isCatalog ? (
              <View className="bg-brand-50 rounded-2xl p-4 border border-brand-100">
                <Text className="text-[10px] font-black text-brand-700 uppercase mb-1">
                  카탈로그에서 선택됨
                </Text>
                <Text className="text-base font-black text-gray-900">
                  {catalogDisplay.brand || "—"}
                </Text>
                <Text className="text-sm text-gray-600">
                  {catalogDisplay.model}
                </Text>
              </View>
            ) : (
              <>
                <Field
                  label="브랜드 *"
                  value={brand}
                  onChangeText={setBrand}
                  placeholder="예: 스쿠버프로"
                  editable={!submitting}
                />
                <Field
                  label="모델명 *"
                  value={model}
                  onChangeText={setModel}
                  placeholder="예: MK25 EVO / S620Ti"
                  editable={!submitting}
                />
              </>
            )}

            <View className="gap-1.5">
              <Text className="text-xs font-bold text-gray-700">카테고리 *</Text>
              {hasPresetCategory ? (
                // 카테고리가 검색/카드에서 결정된 상태 — 한 줄로 락 표시
                <View className="flex-row items-center self-start bg-brand-50 border border-brand-100 rounded-2xl px-4 py-2.5">
                  <Text className="text-xs font-black text-brand-700">
                    {CATEGORY_LABEL[category]}
                  </Text>
                </View>
              ) : (
                // 직접 등록 / 수정 모드 — picker 노출
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {EQUIPMENT_CATEGORIES.map((c) => {
                      const active = category === c;
                      return (
                        <Pressable
                          key={c}
                          onPress={() => setCategory(c)}
                          disabled={submitting}
                          className={`px-4 py-2.5 rounded-2xl border ${
                            active
                              ? "bg-brand-600 border-brand-600"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <Text
                            className={`text-xs font-black ${
                              active ? "text-brand-fg" : "text-gray-700"
                            }`}
                          >
                            {CATEGORY_LABEL[c]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>

            <Field
              label="시리얼 번호 (선택)"
              value={serialNo}
              onChangeText={setSerialNo}
              placeholder="장비 본체에 새겨진 번호"
              editable={!submitting}
            />

            <DateField
              label="구입 일자 (선택)"
              value={purchasedAt}
              onChange={setPurchasedAt}
              mode="date"
              placeholder="YYYY-MM-DD"
              disabled={submitting}
              maximumDate={new Date()}
            />

            <View className="gap-1">
              <Text className="text-xs font-bold text-gray-700">메모 (선택)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="구매처, 정비 이력, 특이사항"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!submitting}
                className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 bg-white min-h-20"
              />
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              className="bg-brand-600 p-4 rounded-2xl items-center mt-2"
            >
              {submitting ? (
                <ActivityIndicator color={colors.brand.fg} />
              ) : (
                <Text className="text-brand-fg font-black">
                  {isEdit ? "저장" : "등록"}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </KeyboardSafeScroll>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
}: FieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-bold text-gray-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        className="border border-gray-200 rounded-2xl p-4 text-base text-gray-900 bg-white"
      />
    </View>
  );
}
