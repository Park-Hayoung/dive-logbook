import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────────
// 앱 전역에서 쓰는 카테고리 키. equipment_brands.category / user_equipment.category
// 모두 이 값들을 사용.
export const EQUIPMENT_CATEGORIES = [
  "BCD",
  "BACKPLATE",
  "REGULATOR",
  "COMPUTER",
  "GAUGE",
  "MASK",
  "SNORKEL",
  "FIN",
  "BOOTS",
  "GLOVES",
  "HOOD",
  "WETSUIT",
  "DRYSUIT",
  "WEIGHT",
  "LIGHT",
  "KNIFE",
  "TANK",
  "OTHER",
] as const;

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  BCD: "BCD 자켓",
  BACKPLATE: "백플레이트",
  REGULATOR: "호흡기",
  COMPUTER: "다이브 컴퓨터",
  GAUGE: "게이지",
  MASK: "마스크",
  SNORKEL: "스노클",
  FIN: "오리발",
  BOOTS: "부츠",
  GLOVES: "장갑",
  HOOD: "후드",
  WETSUIT: "웨트슈트",
  DRYSUIT: "드라이슈트",
  WEIGHT: "웨이트",
  LIGHT: "라이트",
  KNIFE: "나이프",
  TANK: "공기통",
  OTHER: "기타",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type UserEquipment = {
  id: string;
  userId: string;
  equipmentId: string | null;
  customBrand: string | null;
  customModel: string | null;
  category: EquipmentCategory;
  serialNo: string | null;
  purchasedAt: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  // 카탈로그 join (있을 때만)
  catalog: {
    id: string;
    brand: string | null;
    brandEn: string | null;
    model: string;
    category: string;
  } | null;
};

type UserEquipmentRow = {
  id: string;
  user_id: string;
  equipment_id: string | null;
  custom_brand: string | null;
  custom_model: string | null;
  category: string;
  serial_no: string | null;
  purchased_at: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  catalog:
    | {
        id: string;
        brand: string | null;
        brand_en: string | null;
        model: string;
        category: string;
      }
    | null;
};

export type EquipmentSearchResult =
  | {
      kind: "brand";
      // brand × category combo, 모델은 사용자 입력 받아야 함
      brand: string;
      brandEn: string | null;
      category: EquipmentCategory;
    }
  | {
      kind: "catalog";
      // 정확한 제품명까지 있는 카탈로그 항목 (UGC + 추후 시드)
      id: string;
      brand: string | null;
      brandEn: string | null;
      model: string;
      category: EquipmentCategory;
    };

const mapUserEquipment = (r: UserEquipmentRow): UserEquipment => ({
  id: r.id,
  userId: r.user_id,
  equipmentId: r.equipment_id,
  customBrand: r.custom_brand,
  customModel: r.custom_model,
  category: r.category as EquipmentCategory,
  serialNo: r.serial_no,
  purchasedAt: r.purchased_at,
  photoUrl: r.photo_url,
  notes: r.notes,
  createdAt: r.created_at,
  catalog: r.catalog
    ? {
        id: r.catalog.id,
        brand: r.catalog.brand,
        brandEn: r.catalog.brand_en,
        model: r.catalog.model,
        category: r.catalog.category,
      }
    : null,
});

// 표시용 헬퍼: 카탈로그 우선, 없으면 custom_*
export function displayName(item: UserEquipment): {
  brand: string;
  model: string;
} {
  if (item.catalog) {
    return {
      brand: item.catalog.brand ?? "—",
      model: item.catalog.model,
    };
  }
  return {
    brand: item.customBrand ?? "—",
    model: item.customModel ?? "—",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────
export function useUserEquipment(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-equipment", userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserEquipment[]> => {
      const { data, error } = await supabase
        .from("user_equipment")
        .select(
          `id, user_id, equipment_id, custom_brand, custom_model, category,
           serial_no, purchased_at, photo_url, notes, created_at,
           catalog:equipment!equipment_id(id, brand, brand_en, model, category)`,
        )
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message || JSON.stringify(error));
      return ((data ?? []) as unknown as UserEquipmentRow[]).map(
        mapUserEquipment,
      );
    },
  });
}

// 검색: 브랜드 시드 (equipment_brands) + 카탈로그 (equipment) 두 소스 병합.
//
// 멀티 토큰 매칭:
//   "스쿠버프로 MK25" → 두 토큰. 각 토큰이 brand|brand_en|model 어딘가엔 매칭돼야
//   결과 포함 (AND of OR). 한 행에서 brand="스쿠버프로", model="...MK25..." 면 통과.
//
// 한글 + 영문(name_en/brand_en) 모두 ilike — "Scubapro" 입력해도 한글 시드 매칭.
export function useEquipmentSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["equipment-search", trimmed],
    enabled: trimmed.length >= 1,
    queryFn: async (): Promise<EquipmentSearchResult[]> => {
      // 공백으로 토큰화. 빈 토큰 제거. 단일 토큰이면 split 결과 1개 → 기존 동작과 동일.
      const tokens = trimmed.split(/\s+/).filter(Boolean);

      let brandsQ = supabase
        .from("equipment_brands")
        .select("name, name_en, category")
        .order("name")
        .limit(40);
      let catalogQ = supabase
        .from("equipment")
        .select("id, brand, brand_en, model, category")
        .limit(40);

      // 토큰별 .or() 체이닝 — Supabase JS 는 여러 .or() 호출을 AND 로 결합한다.
      for (const tok of tokens) {
        const t = `%${tok}%`;
        brandsQ = brandsQ.or(`name.ilike.${t},name_en.ilike.${t}`);
        catalogQ = catalogQ.or(
          `brand.ilike.${t},brand_en.ilike.${t},model.ilike.${t}`,
        );
      }

      const [brandsRes, catalogRes] = await Promise.all([brandsQ, catalogQ]);

      if (brandsRes.error) throw new Error(brandsRes.error.message);
      if (catalogRes.error) throw new Error(catalogRes.error.message);

      const brandRows = (brandsRes.data ?? []) as unknown as {
        name: string;
        name_en: string | null;
        category: string;
      }[];
      const catalogRows = (catalogRes.data ?? []) as unknown as {
        id: string;
        brand: string | null;
        brand_en: string | null;
        model: string;
        category: string;
      }[];

      // 브랜드 카드는 (name, category) 기준으로 dedupe — 영문 매칭 + 한글 매칭이 둘 다
      // 잡히는 경우 같은 행이 한 번만 나오게.
      const brandSeen = new Set<string>();
      const brandResults: EquipmentSearchResult[] = [];
      for (const r of brandRows) {
        const k = `${r.name}::${r.category}`;
        if (brandSeen.has(k)) continue;
        brandSeen.add(k);
        brandResults.push({
          kind: "brand",
          brand: r.name,
          brandEn: r.name_en,
          category: r.category as EquipmentCategory,
        });
      }

      const catalogResults: EquipmentSearchResult[] = catalogRows.map(
        (r): EquipmentSearchResult => ({
          kind: "catalog",
          id: r.id,
          brand: r.brand,
          brandEn: r.brand_en,
          model: r.model,
          category: r.category as EquipmentCategory,
        }),
      );

      // 정확한 카탈로그 매치 먼저, 그 다음 브랜드 카드
      return [...catalogResults, ...brandResults];
    },
  });
}

// 모든 브랜드를 카테고리별로 보여주는 둘러보기 화면용 (검색어 없을 때).
export function useEquipmentBrandsByCategory(category: EquipmentCategory | null) {
  return useQuery({
    queryKey: ["equipment-brands", category ?? "all"],
    enabled: !!category,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_brands")
        .select("name, category")
        .eq("category", category!)
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as { name: string; category: string }[];
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

// 브랜드 카드(카탈로그 미존재) → 모델명 사용자 입력 후 등록.
// 또는 카탈로그 항목(equipment) → equipment_id 로 등록.
// 또는 완전 자유입력.
export type RegisterEquipmentInput =
  | {
      kind: "catalog";
      equipmentId: string;
      category: EquipmentCategory;
      serialNo?: string | null;
      purchasedAt?: string | null;
      notes?: string | null;
    }
  | {
      kind: "custom";
      brand: string;
      model: string;
      category: EquipmentCategory;
      serialNo?: string | null;
      purchasedAt?: string | null;
      notes?: string | null;
    };

export function useRegisterEquipment(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterEquipmentInput): Promise<string> => {
      if (!userId) throw new Error("로그인이 필요해요.");

      const base = {
        user_id: userId,
        category: input.category,
        serial_no: input.serialNo ?? null,
        purchased_at: input.purchasedAt ?? null,
        notes: input.notes ?? null,
      };

      const row =
        input.kind === "catalog"
          ? { ...base, equipment_id: input.equipmentId }
          : {
              ...base,
              custom_brand: input.brand,
              custom_model: input.model,
            };

      const { data, error } = await supabase
        .from("user_equipment")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-equipment", userId] });
    },
  });
}

// 단건 조회 — 수정 화면 프리필용.
export function useUserEquipmentItem(id: string | undefined) {
  return useQuery({
    queryKey: ["user-equipment-item", id],
    enabled: !!id,
    queryFn: async (): Promise<UserEquipment | null> => {
      const { data, error } = await supabase
        .from("user_equipment")
        .select(
          `id, user_id, equipment_id, custom_brand, custom_model, category,
           serial_no, purchased_at, photo_url, notes, created_at,
           catalog:equipment!equipment_id(id, brand, brand_en, model, category)`,
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw new Error(error.message || JSON.stringify(error));
      if (!data) return null;
      return mapUserEquipment(data as unknown as UserEquipmentRow);
    },
  });
}

// 보유 장비 메타데이터 수정. equipment_id 자체는 못 바꿈 (등록 시점에 결정).
// custom 항목은 brand/model 도 수정 가능.
export type UpdateEquipmentInput = {
  category: EquipmentCategory;
  serialNo?: string | null;
  purchasedAt?: string | null;
  notes?: string | null;
  // custom 항목일 때만 사용 — 카탈로그 항목은 무시됨.
  customBrand?: string | null;
  customModel?: string | null;
};

export function useUpdateUserEquipment(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: UpdateEquipmentInput }) => {
      if (!userId) throw new Error("로그인이 필요해요.");

      const row: Record<string, unknown> = {
        category: args.patch.category,
        serial_no: args.patch.serialNo ?? null,
        purchased_at: args.patch.purchasedAt ?? null,
        notes: args.patch.notes ?? null,
      };
      if (args.patch.customBrand !== undefined)
        row.custom_brand = args.patch.customBrand;
      if (args.patch.customModel !== undefined)
        row.custom_model = args.patch.customModel;

      const { error } = await supabase
        .from("user_equipment")
        .update(row)
        .eq("id", args.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["user-equipment", userId] });
      qc.invalidateQueries({ queryKey: ["user-equipment-item", vars.id] });
    },
  });
}

export function useDeleteUserEquipment(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("로그인이 필요해요.");
      const { error } = await supabase
        .from("user_equipment")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-equipment", userId] });
    },
  });
}
