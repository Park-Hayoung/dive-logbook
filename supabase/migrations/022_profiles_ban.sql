-- 022_profiles_ban.sql
-- 회원 정지 / 영구 삭제 표시(soft delete) 를 위한 profiles 컬럼 추가.
--
-- 정책 방향 (Phase 1):
--   1. 정지(ban) 는 **표시만** — 모바일 앱 로그인 차단 등 enforce 는 별도 단계에서.
--      dive-admin 운영자 콘솔에서 banned 회원을 식별/관리할 수 있게 하는 게 목표.
--   2. 영구 삭제는 cascade 영향이 크므로(다이브, 피드, 댓글, 좋아요까지) 우선
--      **soft delete (deleted_at 마킹)** 를 기본 동작으로. 실제 cascade DELETE 는
--      superadmin 전용 별도 액션으로 처리. 이 마이그레이션은 마킹 컬럼만 추가.
--
-- 호환성: 기본값으로 채워지므로 기존 행에 추가 작업 불필요. 모바일 앱은
-- 이 컬럼을 모르고 동작해도 무관(SELECT 시 추가 컬럼만 무시됨).

alter table public.profiles
  add column if not exists is_banned       boolean     not null default false,
  add column if not exists banned_at       timestamptz,
  add column if not exists banned_reason   text,
  add column if not exists banned_by       uuid        references public.admin_users(id) on delete set null,
  add column if not exists deleted_at      timestamptz,
  add column if not exists deleted_by      uuid        references public.admin_users(id) on delete set null;

-- 운영자 콘솔에서 "정지된 회원" / "삭제된 회원" 필터를 빠르게 보여주기 위함.
-- partial index 로 일반 회원(99% 케이스)에는 인덱스 비용 안 들게.
create index if not exists profiles_is_banned_idx
  on public.profiles (banned_at desc)
  where is_banned = true;

create index if not exists profiles_deleted_idx
  on public.profiles (deleted_at desc)
  where deleted_at is not null;

comment on column public.profiles.is_banned is
  '운영자에 의한 정지 여부. Phase 1 에서는 표시만, 모바일 앱 로그인 차단은 별도 단계.';
comment on column public.profiles.banned_reason is
  '정지 사유(운영자가 입력). audit log 에도 함께 기록됨.';
comment on column public.profiles.deleted_at is
  'soft delete 마킹. NULL 이 아니면 운영자가 삭제 처리한 회원. 실제 cascade DELETE 는 별도 superadmin 액션.';
