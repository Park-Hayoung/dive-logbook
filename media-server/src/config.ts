function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  storageRoot: process.env.STORAGE_ROOT ?? "/data",
  publicBaseUrl: required("PUBLIC_BASE_URL").replace(/\/$/, ""),
  // Supabase project URL (e.g. https://abcd.supabase.co) — used to fetch JWKS
  // for ES256/RS256 token verification on newer projects.
  supabaseUrl: optional("SUPABASE_URL")?.replace(/\/$/, ""),
  // Legacy HS256 shared secret. Optional — only needed if a token uses HS256.
  supabaseJwtSecret: optional("SUPABASE_JWT_SECRET"),
  uploadHmacSecret: required("UPLOAD_HMAC_SECRET"),
  uploadUrlTtlSeconds: Number(process.env.UPLOAD_URL_TTL ?? 900),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 2 * 1024 * 1024 * 1024),
};
