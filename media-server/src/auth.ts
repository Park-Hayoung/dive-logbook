import { jwtVerify } from "jose";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

export type SupabaseClaims = {
  sub: string;     // user UUID (auth.uid())
  email?: string;
  role?: string;
  exp: number;
};

// Verify a Supabase-issued JWT (HS256 with project JWT secret).
export async function verifySupabaseJwt(token: string): Promise<SupabaseClaims> {
  const secret = new TextEncoder().encode(config.supabaseJwtSecret);
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("JWT missing sub claim");
  }
  return payload as unknown as SupabaseClaims;
}

// Sign a short-lived upload payload. Returns base64url(HMAC).
// The signed string is "<userId>|<diveId>|<filename>|<expiresAt>".
export function signUploadPayload(
  userId: string,
  diveId: string,
  filename: string,
  expiresAt: number,
): string {
  const data = `${userId}|${diveId}|${filename}|${expiresAt}`;
  const h = createHmac("sha256", config.uploadHmacSecret);
  h.update(data);
  return h.digest("base64url");
}

export function verifyUploadSignature(
  signature: string,
  userId: string,
  diveId: string,
  filename: string,
  expiresAt: number,
): boolean {
  if (Date.now() > expiresAt) return false;
  const expected = signUploadPayload(userId, diveId, filename, expiresAt);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
