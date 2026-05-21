-- 026_push_token_register_rpc.sql
-- profile_push_tokens 의 upsert 를 SECURITY DEFINER 로 처리하는 RPC.
--
-- 배경: 025 의 RLS UPDATE 정책은 `auth.uid() = user_id` 를 요구. 같은 디바이스(=같은 token)
-- 가 다른 user_id 로 재로그인하는 정상 케이스(기기 공유, 계정 전환) 에서
-- 기존 행 소유자가 auth.uid() 와 달라 USING 절을 통과 못 함.
--
-- 해결: 토큰 등록을 RPC 로 캡슐화. RPC 안에서 user_id 를 강제로 auth.uid() 로 세팅 →
-- 다른 사람 토큰을 훔쳐와도 결국 본인 user_id 로 묶이므로 보안 손실 없음.

create or replace function public.register_push_token(
  p_token text,
  p_platform text,
  p_device_label text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform: %', p_platform;
  end if;
  if p_token is null or length(p_token) = 0 then
    raise exception 'token required';
  end if;

  insert into public.profile_push_tokens (user_id, token, platform, device_label, last_seen_at)
  values (auth.uid(), p_token, p_platform, p_device_label, now())
  on conflict (token) do update set
    user_id      = excluded.user_id,
    platform     = excluded.platform,
    device_label = excluded.device_label,
    last_seen_at = excluded.last_seen_at;
end;
$$;

grant execute on function public.register_push_token(text, text, text) to authenticated;

comment on function public.register_push_token(text, text, text) is
  '푸시 토큰 등록 — RLS 우회 (계정 전환 시 기존 행이 다른 user_id 일 수 있어 RLS UPDATE 정책으로 안 잡힘). user_id 강제 = auth.uid() 라 보안 손실 없음.';
