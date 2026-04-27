function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  storageRoot: process.env.STORAGE_ROOT ?? "/data",
  publicBaseUrl: required("PUBLIC_BASE_URL").replace(/\/$/, ""),
  supabaseJwtSecret: required("SUPABASE_JWT_SECRET"),
  uploadHmacSecret: required("UPLOAD_HMAC_SECRET"),
  uploadUrlTtlSeconds: Number(process.env.UPLOAD_URL_TTL ?? 900),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 2 * 1024 * 1024 * 1024),
};
