-- 이미 시드된 equipment 행에서 마케팅 prefix / 판매 메타 텍스트 정리.
-- 새 크롤러는 자동 정리하므로, 기존 데이터를 재크롤 없이 같은 자리에서 정리할 때 사용.
--
-- 처리:
--   1) 렌탈 행 DELETE (model 에 "렌탈" 포함 시 통째 삭제 — 본인 보유 장비 카탈로그라 무의미)
--   2) [재입고 미정] / ★특별세일★ / ☆..☆ / ⭐..⭐ 등 시작 prefix 6단 중첩 제거
--   3) 판매 메타 괄호 제거: (개별 구매), (단품), (특가), (NEW), (예약 판매) 등
--      — 정상 spec 괄호("(D타입)", "(GP-7028)", "(40cf, 80cf)") 는 보존
--   4) 빈 model 된 행 정리

begin;

-- 1) 렌탈 행 삭제
delete from public.equipment
where source = 'pongdang_seed'
  and model ~ '렌탈';

-- 2) prefix + 3) 판매 메타 괄호 정리 (한 UPDATE 안에서 중첩 적용)
with cleaned as (
  select
    id,
    model as old_model,
    -- 단계: prefix 6단 → 판매 메타 괄호 → 공백 정규화
    regexp_replace(
      regexp_replace(
        regexp_replace(
        regexp_replace(
        regexp_replace(
        regexp_replace(
        regexp_replace(
        regexp_replace(
          model,
          '^\s*(\[[^\]]*\]|★[^★]*★|☆[^☆]*☆|⭐[^⭐]*⭐)\s*', ''),
          '^\s*(\[[^\]]*\]|★[^★]*★|☆[^☆]*☆|⭐[^⭐]*⭐)\s*', ''),
          '^\s*(\[[^\]]*\]|★[^★]*★|☆[^☆]*☆|⭐[^⭐]*⭐)\s*', ''),
          '^\s*(\[[^\]]*\]|★[^★]*★|☆[^☆]*☆|⭐[^⭐]*⭐)\s*', ''),
          '^\s*(\[[^\]]*\]|★[^★]*★|☆[^☆]*☆|⭐[^⭐]*⭐)\s*', ''),
          '^\s*(\[[^\]]*\]|★[^★]*★|☆[^☆]*☆|⭐[^⭐]*⭐)\s*', ''),
        -- 판매 메타 괄호: 괄호 안에 키워드 하나라도 있으면 괄호째 제거 (g 플래그로 여러 개)
        '\s*\([^)]*(개별\s*구매|개\s*이상|구매\s*가능|단품|풀\s*세트|풀\s*셋|특가|할인|이벤트|증정|NEW|신상|예약\s*판매|재고\s*소진|재입고)[^)]*\)',
        '', 'gi'
      ),
      -- 다중 공백 → 단일 공백
      '\s+', ' ', 'g'
    ) as new_model
  from public.equipment
  where source = 'pongdang_seed'
)
update public.equipment e
set model = trim(c.new_model)
from cleaned c
where e.id = c.id
  and trim(c.new_model) <> ''
  and trim(c.new_model) <> trim(c.old_model);

-- 4) 정리 후 빈 model 된 행 삭제
delete from public.equipment
where source = 'pongdang_seed'
  and (model is null or trim(model) = '');

commit;
