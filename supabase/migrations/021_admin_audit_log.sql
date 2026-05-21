-- 021_admin_audit_log.sql
-- 운영자가 수행한 모든 변경 액션을 자동 기록하는 감사 로그(audit trail).
--
-- 누가(admin_id) / 언제(created_at) / 무엇을(action, target) / 어떤 데이터로(payload)
-- 했는지 추적 가능. 회원 정지·게시물 삭제 같은 강한 권한 액션의 사후 검증과
-- 책임 추적에 사용.
--
-- admin_users 와 동일하게 anon/authenticated 차단, service_role 전용.

create table public.admin_audit_log (
  id          uuid primary key default uuid_generate_v4(),
  admin_id    uuid references public.admin_users(id) on delete set null,
  action      text not null,                -- 'ban_user', 'delete_feed', 'merge_equipment', ...
  target_type text not null,                -- 'profile', 'feed', 'equipment', ...
  target_id   text not null,                -- uuid 또는 복합키 문자열
  payload     jsonb,                        -- 변경 전/후 또는 부가 데이터
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index admin_audit_log_admin_idx
  on public.admin_audit_log (admin_id, created_at desc);

create index admin_audit_log_target_idx
  on public.admin_audit_log (target_type, target_id, created_at desc);

create index admin_audit_log_action_idx
  on public.admin_audit_log (action, created_at desc);

-- ============================================================================
-- RLS — service_role 전용
-- ============================================================================
alter table public.admin_audit_log enable row level security;
-- 정책 없음 = 모두 차단. service_role 우회.

comment on table public.admin_audit_log is
  '운영자 액션 감사 로그. 모든 admin 변경 action 은 dive-admin 백엔드에서 자동 INSERT.';
