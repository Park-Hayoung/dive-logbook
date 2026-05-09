-- 017_user_certifications.sql
-- 자격증(C-card) 멀티 등록.
-- profiles.certification / diving_org 은 "대표 카드" 표시용으로 그대로 유지.
-- 한 명이 PADI Open Water + SSI Advanced 처럼 여러 단체/레벨을 들고 있을 수 있음.

create table public.user_certifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  organization      text not null,
  level             text not null,
  cert_number       text,
  issued_on         date,
  card_image_url    text not null,
  card_filename     text not null,
  provider          text default 'synology',
  is_primary        boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index user_certifications_user_idx
  on public.user_certifications (user_id, created_at desc);

-- 한 사용자당 대표 카드는 최대 1개. 여러 행이 is_primary=true 로 들어오는 걸 차단.
create unique index user_certifications_one_primary
  on public.user_certifications (user_id)
  where is_primary;

alter table public.user_certifications enable row level security;

-- 누구나 읽기 (프로필 화면에서 다른 다이버 카드 보기). 사진은 어차피 NAS 공개 URL.
create policy user_certifications_read
  on public.user_certifications for select using (true);

-- 본인만 INSERT/UPDATE/DELETE.
create policy user_certifications_owner
  on public.user_certifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_certifications is
  '사용자별 자격증 카드(C-card) 사진/메타. 멀티 단체/레벨 보유 지원.';
