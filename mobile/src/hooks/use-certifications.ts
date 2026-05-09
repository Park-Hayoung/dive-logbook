import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import { mediaStorage } from "@/src/services/media-storage";

// user_certifications 테이블은 017 마이그레이션으로 추가됨. database.ts 타입이
// 재생성되기 전까지 `supabase.from("user_certifications")` 가 컴파일 에러를 내므로
// 캐스팅으로 우회. 적용 후 `npx supabase gen types typescript ...` 실행하면 제거 가능.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type Certification = {
  id: string;
  user_id: string;
  organization: string;
  level: string;
  cert_number: string | null;
  issued_on: string | null;
  card_image_url: string;
  card_filename: string;
  provider: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

const queryKey = (userId: string | undefined) => ["certifications", userId];

export function useCertifications(userId: string | undefined) {
  return useQuery({
    queryKey: queryKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Certification[]> => {
      const { data, error } = await sb
        .from("user_certifications")
        .select("*")
        .eq("user_id", userId!)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Certification[];
    },
  });
}

const filenameFromUri = (uri: string): string => {
  const last = uri.split("/").pop();
  if (last && last.includes(".")) return last;
  return "card.jpg";
};

export type AddCertificationInput = {
  organization: string;
  level: string;
  certNumber?: string | null;
  issuedOn?: string | null; // YYYY-MM-DD
  cardLocalUri: string;
  contentType?: string;
  isPrimary?: boolean;
};

export function useAddCertification(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddCertificationInput) => {
      if (!userId) throw new Error("로그인이 필요해요.");

      const uploaded = await mediaStorage.upload({
        scope: { type: "certification" },
        localUri: input.cardLocalUri,
        originalFilename: filenameFromUri(input.cardLocalUri),
        contentType: input.contentType ?? "image/jpeg",
      });

      // If marking primary, unset existing primary first to satisfy unique
      // partial index. Same-statement update to keep this race-light.
      if (input.isPrimary) {
        await sb
          .from("user_certifications")
          .update({ is_primary: false })
          .eq("user_id", userId)
          .eq("is_primary", true);
      }

      const { data, error } = await sb
        .from("user_certifications")
        .insert({
          user_id: userId,
          organization: input.organization,
          level: input.level,
          cert_number: input.certNumber ?? null,
          issued_on: input.issuedOn ?? null,
          card_image_url: uploaded.url,
          card_filename: uploaded.filename,
          provider: uploaded.provider,
          is_primary: !!input.isPrimary,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Certification;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(userId) });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}

export function useDeleteCertification(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cert: Certification) => {
      // Delete row first (RLS-protected). If the file delete then fails,
      // we'll have an orphan file but no broken DB reference.
      const { error } = await sb
        .from("user_certifications")
        .delete()
        .eq("id", cert.id);
      if (error) throw error;
      try {
        await mediaStorage.delete(
          { type: "certification" },
          cert.card_filename,
        );
      } catch (e) {
        // Non-fatal: log, but don't surface as failure.
        console.warn("[certifications] file delete failed", e);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(userId) });
    },
  });
}

export function useSetPrimaryCertification(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (certId: string) => {
      if (!userId) throw new Error("로그인이 필요해요.");
      // Clear current primary, then set the new one. Two statements is fine —
      // unique partial index protects us if both pass concurrently (one will
      // fail and we'll bubble it up).
      await sb
        .from("user_certifications")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .eq("is_primary", true);
      const { error } = await sb
        .from("user_certifications")
        .update({ is_primary: true })
        .eq("id", certId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKey(userId) });
    },
  });
}
