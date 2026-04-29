-- 009_places_api_usage.sql
-- Google Places API 일일 호출 캡 (앱 레벨 enforce).
-- Maps Platform 콘솔에서는 quota 를 낮출 수 없어서 (조정 가능 여부: 아니요)
-- Supabase RPC 로 직접 카운트하고 cap 초과 시 거부 → 무료 한도 안에서만 동작.
--
-- 운영: 매 호출 직전 클라이언트가 bump_places_usage() 호출 → allowed=false 면
-- Google API 호출 자체를 안 함. 캡 변경은 함수의 p_cap 인자로 동적 조정 가능.

create table public.places_api_usage (
  day        date primary key,
  count      int  not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.bump_places_usage(p_cap int default 333)
returns table(allowed boolean, used_today int, cap int)
language plpgsql
security definer
set search_path = public
as $$
declare
  today_utc date := (now() at time zone 'utc')::date;
  current_count int;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into places_api_usage(day, count, updated_at)
  values (today_utc, 1, now())
  on conflict (day) do update
    set count      = places_api_usage.count + 1,
        updated_at = now()
  returning places_api_usage.count into current_count;

  return query select
    (current_count <= p_cap),
    current_count,
    p_cap;
end;
$$;

-- 일별 사용량 모니터링용 — 누구나 read 가능 (개수만 보임, 민감 정보 없음)
create or replace function public.get_places_usage_today()
returns table(used_today int, day date)
language sql
security definer
set search_path = public
as $$
  select coalesce(count, 0), (now() at time zone 'utc')::date
  from places_api_usage
  where day = (now() at time zone 'utc')::date;
$$;

-- RLS: 테이블 자체는 직접 접근 차단. SECURITY DEFINER RPC 로만 조작.
alter table public.places_api_usage enable row level security;
-- (정책 없음 → 일반 SELECT/INSERT 모두 차단)

grant execute on function public.bump_places_usage(int) to authenticated;
grant execute on function public.get_places_usage_today() to authenticated;
