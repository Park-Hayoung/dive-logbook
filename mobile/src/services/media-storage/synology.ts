import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/src/services/supabase";
import type {
  MediaStorage,
  UploadInput,
  UploadResult,
  UploadScope,
} from "./types";

const MEDIA_API_URL = process.env.EXPO_PUBLIC_MEDIA_API_URL;

if (!MEDIA_API_URL) {
  // Don't throw at module load — only when actually used — so dev can run
  // without media features wired up.
  console.warn("EXPO_PUBLIC_MEDIA_API_URL not set — Synology uploads disabled");
}

type UploadTokenResponse = {
  uploadUrl: string;
  finalUrl: string;
  filename: string;
  expiresAt: number;
};

// Translate a client-side scope into the {kind, …id} body the server expects.
function scopeToTokenBody(scope: UploadScope): Record<string, unknown> {
  switch (scope.type) {
    case "dive":
      return { kind: "dives", diveId: scope.diveId };
    case "avatar":
      return { kind: "avatars" };
    case "feed":
      return { kind: "feeds" };
    case "team":
      return { kind: "teams", teamId: scope.teamId };
    case "certification":
      return { kind: "certifications" };
    case "board":
      return { kind: "boards" };
  }
}

// Map a scope to URL path segments (kind/scopeId) for delete.
function scopeToPathSegments(
  scope: UploadScope,
  selfUserId: string,
): { kind: string; scopeId: string } {
  switch (scope.type) {
    case "dive":
      return { kind: "dives", scopeId: scope.diveId };
    case "avatar":
      return { kind: "avatars", scopeId: selfUserId };
    case "feed":
      return { kind: "feeds", scopeId: selfUserId };
    case "team":
      return { kind: "teams", scopeId: scope.teamId };
    case "certification":
      return { kind: "certifications", scopeId: selfUserId };
    case "board":
      return { kind: "boards", scopeId: selfUserId };
  }
}

async function getUploadToken(
  scope: UploadScope,
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
    body: JSON.stringify({
      ...scopeToTokenBody(scope),
      originalFilename,
      contentType,
    }),
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
      input.scope,
      input.originalFilename,
      input.contentType,
    );

    // Use expo-file-system's uploadAsync to stream the file directly. This is
    // the only reliable way to PUT a binary file in RN — fetch with Blob
    // constructed from ArrayBuffer is not supported, and raw ArrayBuffer body
    // is flaky across platforms.
    const res = await FileSystem.uploadAsync(token.uploadUrl, input.localUri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": input.contentType },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Upload PUT failed: ${res.status} ${res.body}`);
    }
    const parsed = JSON.parse(res.body) as { sizeBytes: number };

    return {
      url: token.finalUrl,
      provider: "synology",
      filename: token.filename,
      sizeBytes: parsed.sizeBytes,
    };
  },

  async delete(scope: UploadScope, filename: string): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    const jwt = session.session?.access_token;
    if (!jwt) throw new Error("Not authenticated");
    if (!MEDIA_API_URL) throw new Error("EXPO_PUBLIC_MEDIA_API_URL not configured");

    const userId = session.session?.user.id;
    if (!userId) throw new Error("Not authenticated");

    const { kind, scopeId } = scopeToPathSegments(scope, userId);
    const url = `${MEDIA_API_URL}/file/${kind}/${encodeURIComponent(scopeId)}/${encodeURIComponent(filename)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) {
      throw new Error(`Delete failed: ${res.status} ${await res.text()}`);
    }
  },
};
