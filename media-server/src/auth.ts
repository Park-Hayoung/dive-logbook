import {
  jwtVerify,
  createRemoteJWKSet,
  decodeProtectedHeader,
  type JWTPayload,
} from "jose";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

export type SupabaseClaims = {
  sub: string;     // user UUID (auth.uid())
  email?: string;
  role?: string;
  exp: number;
};

// JWKS endpoint exposed by every Supabase project (publishes ES256/RS256 public keys).
// Lazy-init so projects without SUPABASE_URL configured can still use the legacy HS256 path.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    if (!config.supabaseUrl) {
      throw new Error(
        "SUPABASE_URL not configured — cannot verify ES256/RS256 tokens",
      );
    }
    jwks = createRemoteJWKSet(
      new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
  }
  return jwks;
}

// Verify a Supabase-issued JWT. Supports both:
//  - Asymmetric (ES256 / RS256) — current Supabase default, verified via JWKS
//  - Symmetric (HS256) — legacy, verified via shared SUPABASE_JWT_SECRET
export async function verifySupabaseJwt(token: string): Promise<SupabaseClaims> {
  const header = decodeProtectedHeader(token);
  let payload: JWTPayload;

  if (header.alg === "HS256") {
    if (!config.supabaseJwtSecret) {
      throw new Error("SUPABASE_JWT_SECRET not configured");
    }
    const secret = new TextEncoder().encode(config.supabaseJwtSecret);
    ({ payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] }));
  } else {
    ({ payload } = await jwtVerify(token, getJwks(), {
      algorithms: ["ES256", "RS256"],
    }));
  }

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
