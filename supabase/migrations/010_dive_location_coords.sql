-- 010_dive_location_coords.sql
-- dives 테이블에 GPS / Places 결과 좌표 + place_id 추가.
-- 자동완성 결과나 GPS 역지오코딩 결과를 받았을 때 채워둠.
-- 직접 입력 시엔 NULL (선택 컬럼).

alter table public.dives
  add column if not exists lat       double precision,
  add column if not exists lng       double precision,
  add column if not exists place_id  text;

-- 좌표 인덱스 — 추후 "근처 다이브" 검색용
create index if not exists dives_geo_idx
  on public.dives (lat, lng)
  where lat is not null and lng is not null;
