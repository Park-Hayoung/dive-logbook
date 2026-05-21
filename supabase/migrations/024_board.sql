-- 024_board.sql
-- 커뮤니티 게시판 — 글/댓글/좋아요/신고.
--
-- 설계 결정 (확정):
--   * 카테고리: enum 으로 고정. 자유/질문/후기/장비/모임/공지. '공지' 는 admin 만.
--   * 댓글 nesting: 1단 대댓글까지 (parent_comment_id nullable + 트리거로 깊이 강제).
--     이유 — 한국 카페/당근 패턴, UI 단순, 무한 nesting 은 모바일에서 가독성 ↓.
--   * 미디어: 이미지 다중 + 영상. 피드 NAS 인프라(media-server) 재활용.
--   * 익명: 비허용 (author_id NOT NULL). 다이버 커뮤니티 신뢰 원래 높고, 신고/제재
--     운영 부담 감안. 추후 정책 바뀌면 컬럼 추가하면 됨.
--   * Soft delete: 댓글 달린 글을 hard delete 하면 스레드 깨짐 → deleted_at 마킹.
--     서버 응답에서 "삭제된 글입니다" placeholder 로 렌더.
--   * is_pinned: admin 콘솔 전용 (service_role 로 RLS 우회). 모바일 UI 는 노출 X.
--   * 조회수: view_count 컬럼만 둠. 증가는 RPC 또는 atomic UPDATE 로 처리.
--   * qna_questions / qna_answers (001) 는 한 번도 사용 X → 이 마이그레이션 끝에서 drop.

-- ============================================================================
-- Enums
-- ============================================================================
create type board_category as enum (
  'free',     -- 자유
  'question', -- 질문
  'review',   -- 후기
  'gear',     -- 장비
  'meetup',   -- 모임
  'notice'    -- 공지 (admin only)
);

create type board_report_status as enum ('pending', 'resolved', 'dismissed');

create type board_report_reason as enum (
  'spam',
  'sexual',
  'violence',
  'harassment',
  'misinformation',
  'copyright',
  'other'
);

-- ============================================================================
-- Posts
-- ============================================================================
create table public.board_posts (
  id         uuid primary key default uuid_generate_v4(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  category   board_category not null,
  title      text not null check (length(title) between 1 and 200),
  content    text not null check (length(content) between 1 and 20000),
  is_pinned  boolean not null default false,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 목록 쿼리: (deleted_at IS NULL) 필터 + (is_pinned DESC, created_at DESC) 정렬.
-- partial index 로 살아있는 글에만 인덱스 비용.
create index board_posts_list_idx
  on public.board_posts (is_pinned desc, created_at desc)
  where deleted_at is null;

create index board_posts_category_idx
  on public.board_posts (category, created_at desc)
  where deleted_at is null;

create index board_posts_author_idx
  on public.board_posts (author_id, created_at desc)
  where deleted_at is null;

-- ============================================================================
-- Post media (이미지 다중 + 영상). feed_media 와 동일 구조.
-- ============================================================================
create table public.board_post_media (
  id                uuid primary key default uuid_generate_v4(),
  post_id           uuid not null references public.board_posts(id) on delete cascade,
  storage_url       text not null,
  kind              text not null check (kind in ('image','video')),
  provider          text default 'synology',
  thumbnail_url     text,
  duration_seconds  int,
  width             int,
  height            int,
  file_size_bytes   bigint,
  original_filename text,
  uploaded_at       timestamptz not null default now()
);

create index board_post_media_post_idx
  on public.board_post_media (post_id, uploaded_at);

-- ============================================================================
-- Comments (1단 대댓글)
-- ============================================================================
create table public.board_comments (
  id                uuid primary key default uuid_generate_v4(),
  post_id           uuid not null references public.board_posts(id) on delete cascade,
  author_id         uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.board_comments(id) on delete cascade,
  content           text not null check (length(content) between 1 and 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index board_comments_post_idx
  on public.board_comments (post_id, created_at);

create index board_comments_parent_idx
  on public.board_comments (parent_comment_id, created_at)
  where parent_comment_id is not null;

-- 깊이 1단 강제: parent_comment_id 가 가리키는 댓글은 반드시 최상위(parent IS NULL).
create or replace function public.board_comments_enforce_depth()
returns trigger
language plpgsql
as $$
begin
  if new.parent_comment_id is not null then
    if exists (
      select 1 from public.board_comments
      where id = new.parent_comment_id and parent_comment_id is not null
    ) then
      raise exception '대댓글에는 다시 답글을 달 수 없습니다 (depth=1 only)';
    end if;
  end if;
  return new;
end;
$$;

create trigger board_comments_depth_check
  before insert or update on public.board_comments
  for each row execute function public.board_comments_enforce_depth();

-- ============================================================================
-- Likes
-- ============================================================================
create table public.board_post_likes (
  post_id    uuid references public.board_posts(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index board_post_likes_post_idx
  on public.board_post_likes (post_id);

create table public.board_comment_likes (
  comment_id uuid references public.board_comments(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index board_comment_likes_comment_idx
  on public.board_comment_likes (comment_id);

-- ============================================================================
-- Reports (글/댓글) — feed_reports(023) 패턴 그대로
-- ============================================================================
create table public.board_post_reports (
  id            uuid primary key default uuid_generate_v4(),
  post_id       uuid not null references public.board_posts(id) on delete cascade,
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  reason        board_report_reason not null,
  detail        text,
  status        board_report_status not null default 'pending',
  resolved_at   timestamptz,
  resolved_by   uuid references public.admin_users(id) on delete set null,
  resolver_note text,
  created_at    timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create index board_post_reports_status_created_idx
  on public.board_post_reports (status, created_at desc);

create table public.board_comment_reports (
  id            uuid primary key default uuid_generate_v4(),
  comment_id    uuid not null references public.board_comments(id) on delete cascade,
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  reason        board_report_reason not null,
  detail        text,
  status        board_report_status not null default 'pending',
  resolved_at   timestamptz,
  resolved_by   uuid references public.admin_users(id) on delete set null,
  resolver_note text,
  created_at    timestamptz not null default now(),
  unique (comment_id, reporter_id)
);

create index board_comment_reports_status_created_idx
  on public.board_comment_reports (status, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.board_posts          enable row level security;
alter table public.board_post_media     enable row level security;
alter table public.board_comments       enable row level security;
alter table public.board_post_likes     enable row level security;
alter table public.board_comment_likes  enable row level security;
alter table public.board_post_reports   enable row level security;
alter table public.board_comment_reports enable row level security;

-- ── board_posts ──────────────────────────────────────────────────────────────
-- 모두 read (삭제된 글도 SELECT 가능 — 클라이언트가 placeholder 렌더링).
create policy board_posts_read on public.board_posts for select using (true);

-- 본인이 일반 카테고리로 INSERT. 공지(notice)는 admin(service_role) 만.
create policy board_posts_insert_user on public.board_posts for insert
  with check (
    auth.uid() = author_id
    and category <> 'notice'
    and is_pinned = false
  );

-- 본인이 자기 글 UPDATE. is_pinned/category 'notice' 로 승격 못 함.
create policy board_posts_update_user on public.board_posts for update
  using (auth.uid() = author_id and deleted_at is null)
  with check (
    auth.uid() = author_id
    and category <> 'notice'
    and is_pinned = false
  );

-- 본인이 자기 글 DELETE. (실제로는 앱에서 deleted_at UPDATE 권장하지만 hard delete 도 허용.)
create policy board_posts_delete_user on public.board_posts for delete
  using (auth.uid() = author_id);

-- ── board_post_media ─────────────────────────────────────────────────────────
create policy board_post_media_read on public.board_post_media for select using (true);

create policy board_post_media_owner on public.board_post_media for all
  using (auth.uid() = (select author_id from public.board_posts where id = post_id))
  with check (auth.uid() = (select author_id from public.board_posts where id = post_id));

-- ── board_comments ───────────────────────────────────────────────────────────
create policy board_comments_read on public.board_comments for select using (true);

-- 인증 사용자가 살아있는 글에만 댓글 작성 가능.
create policy board_comments_insert on public.board_comments for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.board_posts
      where id = post_id and deleted_at is null
    )
  );

create policy board_comments_update_user on public.board_comments for update
  using (auth.uid() = author_id and deleted_at is null)
  with check (auth.uid() = author_id);

create policy board_comments_delete_user on public.board_comments for delete
  using (auth.uid() = author_id);

-- ── likes (글/댓글) ──────────────────────────────────────────────────────────
create policy board_post_likes_read on public.board_post_likes for select using (true);
create policy board_post_likes_insert on public.board_post_likes for insert
  with check (auth.uid() = user_id);
create policy board_post_likes_delete on public.board_post_likes for delete
  using (auth.uid() = user_id);

create policy board_comment_likes_read on public.board_comment_likes for select using (true);
create policy board_comment_likes_insert on public.board_comment_likes for insert
  with check (auth.uid() = user_id);
create policy board_comment_likes_delete on public.board_comment_likes for delete
  using (auth.uid() = user_id);

-- ── reports — feed_reports 패턴 그대로 ───────────────────────────────────────
-- 본인 신고만 SELECT. 자기 글/댓글 신고 못 함. 상태 변경은 admin (service_role) 만.
create policy board_post_reports_select_own on public.board_post_reports for select
  using (auth.uid() = reporter_id);

create policy board_post_reports_insert_own on public.board_post_reports for insert
  with check (
    auth.uid() = reporter_id
    and auth.uid() <> (select author_id from public.board_posts where id = post_id)
  );

create policy board_comment_reports_select_own on public.board_comment_reports for select
  using (auth.uid() = reporter_id);

create policy board_comment_reports_insert_own on public.board_comment_reports for insert
  with check (
    auth.uid() = reporter_id
    and auth.uid() <> (select author_id from public.board_comments where id = comment_id)
  );

-- ============================================================================
-- Atomic view increment RPC — 클라이언트 호출용
-- ============================================================================
create or replace function public.board_posts_increment_view(p_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.board_posts
     set view_count = view_count + 1
   where id = p_post_id and deleted_at is null;
$$;

grant execute on function public.board_posts_increment_view(uuid) to authenticated, anon;

-- ============================================================================
-- Table comments
-- ============================================================================
comment on table public.board_posts is
  '커뮤니티 게시판 글. notice 카테고리와 is_pinned 는 admin(service_role) 전용.';
comment on column public.board_posts.deleted_at is
  'soft delete. 클라이언트는 "삭제된 글" placeholder 로 렌더 (스레드 보존).';
comment on table public.board_comments is
  '게시판 댓글. parent_comment_id 로 1단 대댓글까지 허용 (트리거가 깊이 강제).';
comment on table public.board_post_media is
  '게시판 글 첨부 미디어. feed_media 와 동일 구조 — NAS(synology) 기본.';

-- ============================================================================
-- Cleanup — 한 번도 사용되지 않은 qna_* (001) 정리
-- 카테고리 태그(question)로 통합되어 별도 테이블 불필요.
-- ============================================================================
drop table if exists public.qna_answers cascade;
drop table if exists public.qna_questions cascade;
