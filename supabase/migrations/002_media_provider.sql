-- Migration 002: Multi-provider media storage
-- Adds provider tracking + video metadata to dive_media so we can run
-- Synology NAS now and migrate to Cloudflare R2/Stream later without
-- breaking existing rows.

alter table public.dive_media
  add column provider text not null default 'synology'
    check (provider in ('synology','cloudflare-r2','cloudflare-stream','supabase')),
  add column file_size_bytes bigint,
  add column duration_seconds int,
  add column thumbnail_url text,
  add column original_filename text,
  add column width int,
  add column height int;

-- Old rows (if any) are tagged 'supabase'
update public.dive_media set provider = 'supabase' where storage_url like '%supabase.co%';

create index dive_media_provider_idx on public.dive_media (provider);
