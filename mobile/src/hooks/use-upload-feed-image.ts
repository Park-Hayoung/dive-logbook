import { useMutation } from "@tanstack/react-query";
import * as FileSystem from "expo-file-system/legacy";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { supabase } from "@/src/services/supabase";

const guessExtension = (contentType: string): string => {
  const subtype = contentType.split("/")[1] ?? "jpg";
  if (subtype === "jpeg") return "jpg";
  return subtype.toLowerCase();
};

// Uploads a single image to the feed-media bucket. Returns the public URL —
// the caller is responsible for storing it on the relevant row (e.g. feeds.image_url).
export function useUploadFeedImage(userId: string | undefined) {
  return useMutation({
    mutationFn: async (input: {
      localUri: string;
      contentType: string;
    }): Promise<string> => {
      if (!userId) throw new Error("로그인이 필요합니다.");

      const base64 = await FileSystem.readAsStringAsync(input.localUri, {
        encoding: "base64",
      });
      const arrayBuffer = decodeBase64(base64);

      const ext = guessExtension(input.contentType);
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("feed-media")
        .upload(path, arrayBuffer, {
          contentType: input.contentType,
          upsert: false,
          cacheControl: "3600",
        });
      if (uploadError)
        throw new Error(uploadError.message || JSON.stringify(uploadError));

      const {
        data: { publicUrl },
      } = supabase.storage.from("feed-media").getPublicUrl(path);

      return publicUrl;
    },
  });
}
