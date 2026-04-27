import { supabase } from "@/src/services/supabase";
import type { MediaStorage, UploadInput, UploadResult } from "./types";

const MEDIA_API_URL = process.env.EXPO_PUBLIC_MEDIA_API_URL;

if (!MEDIA_API_URL) {
  // We don't throw at module load — only when actually used — so dev can run
  // without media features wired up.
  // eslint-disable-next-line no-console
  console.warn("EXPO_PUBLIC_MEDIA_API_URL not set — Synology uploads disabled");
}

type UploadTokenResponse = {
  uploadUrl: string;
  finalUrl: string;
  filename: string;
  expiresAt: number;
};

async function getUploadToken(
  diveId: string,
  originalFilename: string,
  contentType: string,
): Promise<UploadTokenResponse> {
  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) throw new Error("Not authenticated");
  if (!MEDIA_API_URL) throw new Error("EXPO_PUBLIC_MEDIA_API_URL not configured");

  const res = await fetch(`${MEDIA_API_URL}/upload-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ diveId, originalFilename, contentType }),
  });
  if (!res.ok) {
    throw new Error(`upload-token failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export const synologyStorage: MediaStorage = {
  provider: "synology",

  async upload(input: UploadInput): Promise<UploadResult> {
    const token = await getUploadToken(
      input.diveId,
      input.originalFilename,
      input.contentType,
    );

    // RN's fetch supports streaming a local file via { uri } body in iOS but
    // not Android. The portable approach is to read as Blob and PUT.
    const fileBlob = await fetch(input.localUri).then((r) => r.blob());

    const putRes = await fetch(token.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      body: fileBlob,
    });
    if (!putRes.ok) {
      throw new Error(`Upload PUT failed: ${putRes.status} ${await putRes.text()}`);
    }
    const result = (await putRes.json()) as { sizeBytes: number };

    return {
      url: token.finalUrl,
      provider: "synology",
      filename: token.filename,
      sizeBytes: result.sizeBytes,
    };
  },

  async delete(filename: string, diveId: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    const jwt = session.session?.access_token;
    if (!jwt) throw new Error("Not authenticated");
    if (!MEDIA_API_URL) throw new Error("EXPO_PUBLIC_MEDIA_API_URL not configured");

    const res = await fetch(
      `${MEDIA_API_URL}/file/dives/${encodeURIComponent(diveId)}/${encodeURIComponent(filename)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}` },
      },
    );
    if (!res.ok) {
      throw new Error(`Delete failed: ${res.status} ${await res.text()}`);
    }
  },
};
