-- 007_equipment_english_alias.sql
-- 브랜드 영문명(alias) 추가 — 사용자가 "Scubapro" / "Mares" 같은 영문으로 검색해도
-- 한글 시드("스쿠버프로", "마레스") 와 매칭되도록.
--
-- 모델명은 별도 컬럼 추가하지 않음: 퐁당 상품명에 영문 모델 코드(MK25, S620Ti, EVO)가
-- 한글 상품명 안에 그대로 박혀있어 ilike 검색으로 자연스럽게 잡힘.

-- ============================================================================
-- equipment_brands.name_en
-- ============================================================================
alter table public.equipment_brands
  add column if not exists name_en text;

create index if not exists equipment_brands_name_en_idx
  on public.equipment_brands (name_en);

-- ============================================================================
-- equipment.brand_en
-- ============================================================================
alter table public.equipment
  add column if not exists brand_en text;

create index if not exists equipment_brand_en_idx
  on public.equipment (brand_en);

-- ============================================================================
-- 메이저 다이빙 브랜드 한글 ↔ 영문 alias 매핑
-- ============================================================================
-- 시드된 ~80개 브랜드 중 메이저 / 잘 알려진 30+ 개. 마이너는 NULL 유지(한글 검색만).
-- 같은 브랜드가 여러 카테고리에 있을 수 있으므로 카테고리 무관하게 name 매칭.
update public.equipment_brands set name_en = 'Scubapro'        where name = '스쿠버프로';
update public.equipment_brands set name_en = 'Mares'           where name = '마레스';
update public.equipment_brands set name_en = 'Cressi'          where name = '크레씨';
update public.equipment_brands set name_en = 'Aqualung'        where name = '아쿠아룽';
update public.equipment_brands set name_en = 'Apeks'           where name = '에이펙스';
update public.equipment_brands set name_en = 'Atomic Aquatics' where name = '아토믹';
update public.equipment_brands set name_en = 'Tusa'            where name = '투사';
update public.equipment_brands set name_en = 'Suunto'          where name = '순토';
update public.equipment_brands set name_en = 'Garmin'          where name = '가민';
update public.equipment_brands set name_en = 'Shearwater'      where name = '시어워터';
update public.equipment_brands set name_en = 'Hollis'          where name = '홀리스';
update public.equipment_brands set name_en = 'Oceanic'         where name = '오셔닉';
update public.equipment_brands set name_en = 'Seac'            where name = '시악';
update public.equipment_brands set name_en = 'Bare'            where name = '바레';
update public.equipment_brands set name_en = 'Waterproof'      where name = '워터프루프';
update public.equipment_brands set name_en = 'Beuchat'         where name = '뷰샤';
update public.equipment_brands set name_en = 'Beuchat'         where name = '뷰샤트';
update public.equipment_brands set name_en = 'View'            where name = '뷰';
update public.equipment_brands set name_en = 'Genesis'         where name = '제네시스';
update public.equipment_brands set name_en = 'Leaderfins'      where name = '리더핀';
update public.equipment_brands set name_en = 'Highland'        where name = '하이랜드';
update public.equipment_brands set name_en = 'Santi'           where name = '산티';
update public.equipment_brands set name_en = 'Ikelite'         where name = '아이켈라이트';
update public.equipment_brands set name_en = 'Gear Aid'        where name = '기어에이드(맥넷)';
update public.equipment_brands set name_en = 'McNett'          where name = '맥넷';
update public.equipment_brands set name_en = 'Argon'           where name = '아르곤';
update public.equipment_brands set name_en = 'DiveTec'         where name = '다이브텍';
update public.equipment_brands set name_en = 'Ocean Reef'      where name = '오션리프';
update public.equipment_brands set name_en = 'Dive Rite'       where name = '다이브라이트';
update public.equipment_brands set name_en = 'Halcyon'         where name = '할시온';
update public.equipment_brands set name_en = 'XDeep'           where name = '엑스딥';
update public.equipment_brands set name_en = 'Tecline'         where name = '테크라인';
update public.equipment_brands set name_en = 'Sherwood'        where name = '셔우드';
update public.equipment_brands set name_en = 'Zeagle'          where name = '지글';
update public.equipment_brands set name_en = 'Bigblue'         where name = '빅블루';
update public.equipment_brands set name_en = 'Light & Motion'  where name = '라이트앤모션';
update public.equipment_brands set name_en = 'Subgear'         where name = '서브기어';
update public.equipment_brands set name_en = 'OMS'             where name = '오엠에스';
update public.equipment_brands set name_en = 'Salvimar'        where name = '살비마르';
update public.equipment_brands set name_en = 'Omer'            where name = '오메르';
update public.equipment_brands set name_en = 'Mako'            where name = '마코';
update public.equipment_brands set name_en = 'Problue'         where name = '프로블루';
update public.equipment_brands set name_en = 'Akona'           where name = '아코나';
update public.equipment_brands set name_en = 'Henderson'       where name = '핸더슨';
update public.equipment_brands set name_en = 'Pinnacle'        where name = '피나클';
update public.equipment_brands set name_en = 'Fourth Element'  where name = '포스엘리먼트';
update public.equipment_brands set name_en = 'Aqua Sphere'     where name = '아쿠아스피어';
update public.equipment_brands set name_en = 'Apollo'          where name = '아폴로';
update public.equipment_brands set name_en = 'Gull'            where name = '걸';
update public.equipment_brands set name_en = 'Tusa Sports'     where name = '투사스포츠';
