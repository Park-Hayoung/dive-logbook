-- 015_equipment_user_scoped.sql
-- 마스터 카탈로그 (public.equipment) 의 user-added 항목을 본인에게만 보이도록 제한.
-- 시드/관리자 데이터(created_by IS NULL)는 모두에게 공개 유지.
--
-- 현재 앱은 user_equipment 만 작성하고 equipment 마스터에는 직접 INSERT 하지 않음.
-- 이 마이그레이션은 향후 코드 변경 / 외부 클라이언트 / 데이터 누수 방지용 가드.

alter table public.equipment
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists equipment_created_by_idx on public.equipment (created_by);

-- 기존 정책 교체: SELECT 는 시드/관리자 데이터 + 본인이 추가한 항목만 노출.
drop policy if exists equipment_read on public.equipment;
create policy equipment_read on public.equipment for select
  using (
    created_by is null                -- 시드/관리자 (예: source='pongdang_seed')
    or auth.uid() = created_by        -- 본인이 추가한 항목
  );

-- INSERT: created_by 가 반드시 자기 자신이어야 함 (NULL 로 위장 방지).
drop policy if exists equipment_insert on public.equipment;
create policy equipment_insert on public.equipment for insert
  with check (auth.uid() = created_by);

-- UPDATE/DELETE: 본인이 만든 항목만 가능. 시드(created_by IS NULL) 는 SQL 직접 관리.
create policy equipment_update_own on public.equipment for update
  using (auth.uid() = created_by);
create policy equipment_delete_own on public.equipment for delete
  using (auth.uid() = created_by);

comment on column public.equipment.created_by is
  '사용자가 직접 추가한 항목 추적용. NULL 이면 시드/관리자 데이터 (모두 공개).';
