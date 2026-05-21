-- 025_profile_push_tokens.sql
-- Expo Push 토큰 저장. 한 사용자가 여러 디바이스(iPhone + iPad) 가능 → user_id × token 다대다.
--
-- 정책:
--   * token 자체가 자연 unique (디바이스 1개당 1개). 같은 토큰을 다른 user_id 로 갱신해야 하는
--     경우(같은 폰에서 계정 전환)는 INSERT 시 ON CONFLICT (token) DO UPDATE 로 처리.
--   * 로그아웃 시 본인 토큰 행 DELETE → 그 디바이스로 안 가게.
--   * Edge Function 은 service_role 로 RLS 우회하여 SELECT.

create table public.profile_push_tokens (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  token        text not null,
  platform     text not null check (platform in ('ios', 'android')),
  device_label text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (token)
);

create index profile_push_tokens_user_idx
  on public.profile_push_tokens (user_id);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.profile_push_tokens enable row level security;

-- 본인 토큰만 SELECT (목록 확인용; 보통 안 씀)
create policy profile_push_tokens_select_own on public.profile_push_tokens
  for select using (auth.uid() = user_id);

-- 본인 user_id 로만 INSERT
create policy profile_push_tokens_insert_own on public.profile_push_tokens
  for insert with check (auth.uid() = user_id);

-- 본인 토큰 UPDATE (last_seen_at 갱신, 계정 전환 시 user_id 재할당)
create policy profile_push_tokens_update_own on public.profile_push_tokens
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 본인 토큰 DELETE (로그아웃 정리)
create policy profile_push_tokens_delete_own on public.profile_push_tokens
  for delete using (auth.uid() = user_id);

comment on table public.profile_push_tokens is
  'Expo Push 토큰. 한 디바이스당 1개(token unique). Edge Function 이 service_role 로 조회.';
comment on column public.profile_push_tokens.token is
  'ExponentPushToken[...] 형태의 Expo Push Token. APNs/FCM 토큰이 아님.';
comment on column public.profile_push_tokens.last_seen_at is
  '앱 실행/포그라운드 진입 시마다 갱신. 오래된 토큰은 주기적으로 정리 가능.';
