import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";
import { mediaStorage } from "@/src/services/media-storage";

export type ProfileUpdate = {
  nickname?: string;
  bio?: string | null;
  profileImageUrl?: string | null;
};

export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileUpdate) => {
      if (!userId) throw new Error("로그인이 필요해요.");
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

const filenameFromUri = (uri: string, contentType: string): string => {
  const last = uri.split("/").pop();
  if (last && last.includes(".")) return last;
  const ext = contentType.split("/")[1] ?? "jpg";
  return `avatar.${ext === "jpeg" ? "jpg" : ext}`;
};

export function useUploadAvatar(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { localUri: string; contentType: string }) => {
      if (!userId) throw new Error("로그인이 필요해요.");

      const uploaded = await mediaStorage.upload({
        scope: { type: "avatar" },
        localUri: input.localUri,
        originalFilename: filenameFromUri(input.localUri, input.contentType),
        contentType: input.contentType,
      });

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_image_url: uploaded.url })
        .eq("id", userId);
      if (updateError)
        throw new Error(updateError.message || JSON.stringify(updateError));

      return uploaded.url;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}
