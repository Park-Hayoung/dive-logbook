# DiveLog Media Server

Hono + Node 22 service that runs on a Synology NAS via Docker. Issues short-lived
HMAC-signed upload URLs to authenticated mobile clients (Supabase JWT) and streams
uploads to a local volume served publicly through Cloudflare Tunnel.

## Architecture

```
[RN App, Supabase JWT]
   │ POST /upload-token        (Bearer JWT)
   ▼
[media-server on NAS]          ← verifies JWT, signs URL
   │ returns { uploadUrl, finalUrl, expiresAt }
   ▼
[RN App] PUT uploadUrl (raw bytes, signed)
   ▼
[media-server] streams body → /volume1/divelog-media/dives/<diveId>/<uuid>.<ext>
   ▼
[Cloudflare CDN] caches GET /file/* responses
```

## Quick reference

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /upload-token` | Supabase JWT | Get short-lived signed upload URL |
| `PUT /upload/:userId/:diveId/:filename?exp=&sig=` | HMAC sig | Stream raw file bytes |
| `GET /file/dives/:diveId/:filename` | Public | Serve uploaded file (CDN cached) |
| `DELETE /file/dives/:diveId/:filename` | Supabase JWT | Remove file |
| `GET /health` | None | Liveness check |

## Local development

```bash
npm install
cp .env.example .env       # fill in SUPABASE_JWT_SECRET, UPLOAD_HMAC_SECRET, PUBLIC_BASE_URL
npm run dev
```

## NAS deployment — see `../docs/nas-setup-guide.md` for full walkthrough.
