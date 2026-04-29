-- 008_dive_user_equipment.sql
-- 다이브 ↔ 사용자 보유 장비 조인 (이번 다이브에서 사용한 장비).
-- 기존 dive_equipment(공용 catalog 참조) 와 별도 — 사용자 본인 보유 장비 단위로 추적.

create table public.dive_user_equipment (
  dive_id           uuid not null references public.dives(id) on delete cascade,
  user_equipment_id uuid not null references public.user_equipment(id) on delete cascade,
  created_at        timestamptz default now(),
  primary key (dive_id, user_equipment_id)
);

create index dive_user_equipment_dive_idx on public.dive_user_equipment (dive_id);

alter table public.dive_user_equipment enable row level security;

-- 다이브 자체가 public read 라 사용 장비도 public read
create policy dive_user_equipment_read on public.dive_user_equipment for select
  using (true);

-- 쓰기/삭제는 해당 다이브 소유자만
create policy dive_user_equipment_insert_owner on public.dive_user_equipment for insert
  with check (auth.uid() = (select user_id from public.dives where id = dive_id));
create policy dive_user_equipment_delete_owner on public.dive_user_equipment for delete
  using (auth.uid() = (select user_id from public.dives where id = dive_id));
