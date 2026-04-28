import { useMutation, useQueryClient } from "@tanstack/react-query";
// SDK 54 deprecated the function-based API on the main entry point. The legacy
// path stays stable while we migrate; the new File/Directory class API is also
// available but has different semantics for binary reads.
import * as FileSystem from "expo-file-system/legacy";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { supabase } from "@/src/services/supabase";

export type ProfileUpdate = {
  nickname?: string;
  bio?: string | null;
  profileImageUrl?: string | null;
};

export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileUpdate) => {
      if (!userId) throw new Error("로그인이 필요합니다.");
      const update: Record<string, unknown> = {};
      if (input.nickname !== undefined) update.nickname = input.nickname;
      if (input.bio !== undefined) update.bio = input.bio;
      if (input.profileImageUrl !== undefined)
        update.profile_image_url = input.profileImageUrl;
      const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", userId);
      if (error) throw new Error(error.message || JSON.stringify(error));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}

const guessExtension = (contentType: string): string => {
  const subtype = contentType.split("/")[1] ?? "jpg";
  if (subtype === "jpeg") return "jpg";
  return subtype.toLowerCase();
};

export function useUploadAvatar(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { localUri: string; contentType: string }) => {
      if (!userId) throw new Error("로그인이 필요합니다.");

      // Read local file as base64 then decode to ArrayBuffer.
      // The fetch().blob() pattern is unreliable for file:// URIs on RN —
      // this is Supabase's recommended approach for Expo apps.
      const base64 = await FileSystem.readAsStringAsync(input.localUri, {
        encoding: "base64",
      });
      const arrayBuffer = decodeBase64(base64);

      const ext = guessExtension(input.contentType);
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, arrayBuffer, {
          contentType: input.contentType,
          upsert: true,
          cacheControl: "3600",
        });
      if (uploadError)
        throw new Error(uploadError.message || JSON.stringify(uploadError));

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_image_url: publicUrl })
        .eq("id", userId);
      if (updateError)
        throw new Error(updateError.message || JSON.stringify(updateError));

      return publicUrl;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}
