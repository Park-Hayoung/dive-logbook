-- 023_feed_reports.sql
-- 부적절 피드 신고. 모바일 앱 사용자가 다른 사용자의 피드를 신고하면 INSERT,
-- dive-admin 운영자 콘솔에서 큐로 검토 후 처리(상태 변경 + audit 로깅).
--
-- 정책:
--   1. 같은 사용자가 같은 피드를 여러 번 신고 못 함 (UNIQUE(feed_id, reporter_id)).
--   2. 신고자는 자기 신고만 SELECT 가능. 타인 신고 / 통계는 admin 만.
--   3. INSERT 는 인증된 누구나 가능 (단 reporter_id = auth.uid()).
--   4. status 는 처리 단계 표시. 모바일 앱은 INSERT 만, 상태 변경은 service_role 만.

create type feed_report_status as enum ('pending', 'resolved', 'dismissed');

create type feed_report_reason as enum (
  'spam',          -- 광고/스팸
  'sexual',        -- 음란/성적
  'violence',      -- 폭력/혐오
  'harassment',    -- 괴롭힘/모욕
  'misinformation',-- 허위/기만
  'copyright',     -- 저작권
  'other'
);

create table public.feed_reports (
  id            uuid primary key default uuid_generate_v4(),
  feed_id       uuid not null references public.feeds(id) on delete cascade,
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  reason        feed_report_reason not null,
  detail        text,
  status        feed_report_status not null default 'pending',
  resolved_at   timestamptz,
  resolved_by   uuid references public.admin_users(id) on delete set null,
  resolver_note text,
  created_at    timestamptz not null default now(),
  unique (feed_id, reporter_id)
);

create index feed_reports_status_created_idx
  on public.feed_reports (status, created_at desc);

create index feed_reports_feed_idx
  on public.feed_reports (feed_id, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.feed_reports enable row level security;

-- 본인 신고만 조회 (자기 신고 이력 확인용). 타인 신고 / 통계는 service_role 전용.
create policy feed_reports_select_own on public.feed_reports for select
  using (auth.uid() = reporter_id);

-- 인증된 사용자가 자기 신고만 INSERT. 자기 자신의 피드는 신고 못 하게 한 번 더 가드.
create policy feed_reports_insert_own on public.feed_reports for insert
  with check (
    auth.uid() = reporter_id
    and auth.uid() <> (select author_id from public.feeds where id = feed_id)
  );

-- UPDATE/DELETE 정책 없음 → 모바일 사용자는 신고 취소·수정 불가.
-- dive-admin 은 service_role 로 RLS 우회하여 status 변경.

comment on table public.feed_reports is
  '피드 신고. 모바일 사용자가 INSERT, dive-admin 이 service_role 로 검토/처리.';
comment on column public.feed_reports.reason is
  '신고 사유 카테고리. 자유 텍스트 detail 과 함께 운영자가 종합 판단.';
comment on column public.feed_reports.status is
  'pending=미처리 / resolved=조치(삭제/제재 등) 완료 / dismissed=신고 기각.';
