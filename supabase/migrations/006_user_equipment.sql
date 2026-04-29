-- 006_user_equipment.sql
-- 사용자별 보유 장비 관리.
-- public.equipment 는 이미 001 에서 (id, brand, model, category, unique(brand,model)) 로
-- 카탈로그(공용 마스터) 역할로 만들어져 있음 — 그 위에 개인 소유 테이블을 얹는다.

-- ============================================================================
-- equipment 카탈로그 보강
-- ============================================================================
-- 시드/UGC 추적용 컬럼들. 기존 데이터 보존.
alter table public.equipment
  add column if not exists created_at timestamptz default now();

alter table public.equipment
  add column if not exists source text default 'user';   -- 'pongdang_seed' | 'user'

-- 카테고리 정규화는 앱 레벨(zod/literal)에서 처리. DB는 자유 텍스트.
-- 다만 검색 성능을 위해 인덱스만 추가.
create index if not exists equipment_category_idx on public.equipment (category);
create index if not exists equipment_brand_idx on public.equipment (brand);

-- ============================================================================
-- equipment_brands — 브랜드 × 카테고리 시드 카탈로그
-- ============================================================================
-- 퐁당닷컴 등에서 1회성 시드한 브랜드 목록. 이미지 X, 텍스트만.
-- 브랜드 + 카테고리 조합 단위 (같은 브랜드가 여러 카테고리에서 등장 가능 — 예: Scubapro
-- 가 마스크/BCD/호흡기/컴퓨터 모두에 있음).
-- 검색에서 "스쿠버프로" 입력 → 카테고리별 카드로 펼쳐서 자연스럽게 '브랜드 + 카테고리'
-- 단위 등록 흐름으로 유도. 모델명은 사용자가 자유 입력.
create table public.equipment_brands (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  category   text not null,
  source     text default 'pongdang_seed',
  created_at timestamptz default now(),
  unique (name, category)
);

create index equipment_brands_name_idx on public.equipment_brands (name);
create index equipment_brands_category_idx on public.equipment_brands (category);

alter table public.equipment_brands enable row level security;
create policy equipment_brands_read on public.equipment_brands for select using (true);
-- 시드/관리는 SQL 으로 직접 (UPDATE/DELETE/INSERT 정책 미부여)

-- ============================================================================
-- user_equipment — 개인 보유 장비
-- ============================================================================
create table public.user_equipment (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  -- 카탈로그 참조 (자동완성으로 등록한 경우)
  equipment_id  uuid references public.equipment(id) on delete set null,
  -- 자유입력으로 등록한 경우 사용. 카탈로그 참조가 있어도 별칭으로 덮어쓸 수 있게 nullable.
  custom_brand  text,
  custom_model  text,
  -- 카테고리는 자유입력 분기를 위해 항상 보유 (카탈로그 참조도 비정규화 저장 → 조인 줄임)
  category      text not null,
  serial_no     text,
  purchased_at  date,
  photo_url     text,
  notes         text,
  created_at    timestamptz default now(),
  -- 카탈로그 참조이거나 자유입력이거나 둘 중 하나는 있어야
  check (
    equipment_id is not null
    or (custom_brand is not null and custom_model is not null)
  )
);

create index user_equipment_user_idx on public.user_equipment (user_id, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.user_equipment enable row level security;

-- 본인 것만 조회/수정/삭제. (다이빙 장비는 사적 정보 — feed/profile에서 노출하려면
-- 추후 별도 정책으로 공개 범위 추가)
create policy user_equipment_select_own on public.user_equipment for select
  using (auth.uid() = user_id);
create policy user_equipment_insert_own on public.user_equipment for insert
  with check (auth.uid() = user_id);
create policy user_equipment_update_own on public.user_equipment for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_equipment_delete_own on public.user_equipment for delete
  using (auth.uid() = user_id);
