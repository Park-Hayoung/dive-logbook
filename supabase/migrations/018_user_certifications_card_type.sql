-- 018_user_certifications_card_type.sql
-- e카드(전자 자격증, PADI eCard 등)와 실물 플라스틱 카드를 구분.
-- 실물은 85.6×54 비율로 잘라 보여주는 게 자연스럽지만, e카드는 본체+만료일·강사 등
-- 메타 정보가 한 스크린샷에 같이 있어 강제 크롭이 어울리지 않음.

alter table public.user_certifications
  add column card_type text not null default 'physical'
  check (card_type in ('physical', 'electronic'));

comment on column public.user_certifications.card_type is
  '카드 형태. physical=실물 플라스틱 카드(촬영), electronic=e카드/스크린샷.';
