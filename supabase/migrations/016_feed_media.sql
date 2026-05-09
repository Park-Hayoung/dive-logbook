-- 016_feed_media.sql
-- 일반 피드(로그 공유 X)에서 사진/영상 여러 개를 첨부할 수 있도록 별도 테이블.
-- 로그 공유 피드는 기존대로 dive_media 를 dive_id 로 조회하여 표시.
-- feeds.image_url 은 그리드/리스트 미리보기용 커버 URL 로 유지 (호환성).

create table public.feed_media (
  id                uuid primary key default uuid_generate_v4(),
  feed_id           uuid not null references public.feeds(id) on delete cascade,
  storage_url       text not null,
  kind              text not null check (kind in ('image','video')),
  provider          text default 'synology',
  thumbnail_url     text,
  duration_seconds  int,
  width             int,
  height            int,
  file_size_bytes   bigint,
  original_filename text,
  uploaded_at       timestamptz default now()
);

create index feed_media_feed_idx
  on public.feed_media (feed_id, uploaded_at);

alter table public.feed_media enable row level security;

-- 피드는 공개라 미디어도 모두 읽기 가능.
create policy feed_media_read on public.feed_media for select using (true);

-- 글 작성자만 INSERT/UPDATE/DELETE.
create policy feed_media_owner on public.feed_media for all
  using (auth.uid() = (select author_id from public.feeds where id = feed_id))
  with check (auth.uid() = (select author_id from public.feeds where id = feed_id));

comment on table public.feed_media is
  '일반 피드의 다중 사진/영상. 로그 공유 피드는 dive_media 를 그대로 사용함.';
