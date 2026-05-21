-- 020_admin_users.sql
-- DiveLog 운영자(관리자) 전용 계정 테이블.
--
-- 일반 회원(`auth.users` / `profiles`)과 **완전히 분리**된 인증 도메인.
-- 카카오/구글 OAuth 계정 탈취 = 운영자 권한 탈취가 되지 않도록 분리한 것.
-- 운영자는 별도 이메일/비밀번호 + TOTP 2단계 인증으로만 로그인.
--
-- 핵심 보안 원칙:
--   1. anon / authenticated 역할은 이 테이블 절대 접근 불가 (RLS 정책 0개)
--   2. service_role 만 접근 (RLS 우회). dive-admin 백엔드에서만 사용.
--   3. password_hash 는 bcrypt(12 rounds 권장)
--   4. totp_secret 은 base32 시드 — 분실 시 재발급(superadmin 만)

create type admin_role as enum ('viewer', 'operator', 'superadmin');

create table public.admin_users (
  id            uuid primary key default uuid_generate_v4(),
  email         text unique not null,
  password_hash text not null,
  totp_secret   text not null,
  role          admin_role not null default 'viewer',
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index admin_users_email_idx on public.admin_users (lower(email));

-- 자동 updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger admin_users_set_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS — 정책 0개로 anon/authenticated 차단 (service_role 만 접근 허용)
-- ============================================================================
alter table public.admin_users enable row level security;
-- 의도적으로 정책을 만들지 않음. enable RLS + no policy = 모두 차단.
-- service_role 은 RLS 를 우회하므로 dive-admin 백엔드에서 정상 사용 가능.

comment on table public.admin_users is
  '운영자 콘솔(dive-admin) 전용 계정. 일반 회원과 분리된 인증 도메인. service_role 로만 접근.';
comment on column public.admin_users.role is
  'viewer=읽기 / operator=회원·콘텐츠 관리 / superadmin=운영자 추가·삭제';
comment on column public.admin_users.totp_secret is
  'TOTP base32 시드. Google Authenticator 등으로 발급/검증.';
