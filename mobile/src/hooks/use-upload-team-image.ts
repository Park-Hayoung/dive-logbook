import { useMutation } from "@tanstack/react-query";
import { mediaStorage } from "@/src/services/media-storage";

const filenameFromUri = (uri: string, contentType: string): string => {
  const last = uri.split("/").pop();
  if (last && last.includes(".")) return last;
  const ext = contentType.split("/")[1] ?? "jpg";
  return `team.${ext === "jpeg" ? "jpg" : ext}`;
};

// Uploads a team profile image to the NAS (teams/<teamId>/ folder via
// media-server). Returns the public URL — caller stores it on teams.image_url.
//
// For team CREATION (no teamId yet), use useUploadFeedImage which goes to
// the user's feed folder, then move/copy server-side. For now the simplest
// approach: feed scope for create flow, team scope for edit flow.
export function useUploadTeamImage(userId: string | undefined) {
  return useMutation({
    mutationFn: async (input: {
      teamId: string;
      localUri: string;
      contentType: string;
    }): Promise<string> => {
      if (!userId) throw new Error("로그인이 필요해요.");

      const uploaded = await mediaStorage.upload({
        scope: { type: "team", teamId: input.teamId },
        localUri: input.localUri,
        originalFilename: filenameFromUri(input.localUri, input.contentType),
        contentType: input.contentType,
      });
      return uploaded.url;
    },
  });
}
