-- 019_user_buddies.sql
-- 사용자별 단골 버디 리스트(개인 큐레이션). 장비 관리(`user_equipment`)와 같은 패턴.
-- 다이브-버디 연결 테이블(`dive_buddies`)과는 별개로,
-- "내가 자주 같이 다이빙하는 사람들의 목록"을 따로 보관해
-- 로그 등록 시 빠르게 선택할 수 있게 한다.

create table public.user_buddies (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  buddy_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, buddy_id),
  -- 자기 자신은 버디로 추가할 수 없음.
  check (user_id <> buddy_id)
);

create index user_buddies_user_idx
  on public.user_buddies (user_id, created_at desc);

alter table public.user_buddies enable row level security;

-- 본인 버디 리스트는 본인만 보고/수정. 사적 정보로 취급.
create policy user_buddies_select_own on public.user_buddies for select
  using (auth.uid() = user_id);
create policy user_buddies_insert_own on public.user_buddies for insert
  with check (auth.uid() = user_id);
create policy user_buddies_delete_own on public.user_buddies for delete
  using (auth.uid() = user_id);

comment on table public.user_buddies is
  '사용자별 단골 버디 명단. 로그 등록 시 빠른 선택용 큐레이션 리스트.';

-- ============================================================================
-- 백필: 이미 다이브에 연결돼 있던 버디들을 user_buddies 로 끌어올림.
-- 기존 dive_buddies 의 (다이브 소유자 → 그 다이브에 함께한 user_id) 관계에서
-- 같이 다이빙한 적 있는 모든 사람을 단골 버디로 자동 등록한다.
-- ============================================================================
insert into public.user_buddies (user_id, buddy_id, created_at)
select
  d.user_id   as user_id,
  db.user_id  as buddy_id,
  min(coalesce(d.started_at, now())) as created_at
from public.dive_buddies db
join public.dives d on d.id = db.dive_id
where d.user_id <> db.user_id
group by d.user_id, db.user_id
on conflict (user_id, buddy_id) do nothing;
