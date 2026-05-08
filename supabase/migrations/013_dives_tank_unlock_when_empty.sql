-- Migration 013: Allow user to fill tank pressure when BLE left it empty.
-- AI 트랜스미터 없는 다이브 컴퓨터로 가져온 다이브는 tank_start_bar/tank_end_bar 가
-- NULL 로 들어온다. 이 경우 사용자가 수동으로 채울 수 있어야 함.
-- → trigger 를 갱신해 OLD 값이 NULL 인 탱크 필드만 변경 허용.

create or replace function public.dives_protect_verified()
returns trigger
language plpgsql
as $$
begin
  if old.is_verified = true then
    if new.started_at              is distinct from old.started_at
       or new.ended_at             is distinct from old.ended_at
       or new.max_depth            is distinct from old.max_depth
       or new.avg_depth            is distinct from old.avg_depth
       or new.water_temp           is distinct from old.water_temp
       or new.consumption_bar_per_min is distinct from old.consumption_bar_per_min
       or new.dive_mode            is distinct from old.dive_mode
       or new.gf_low               is distinct from old.gf_low
       or new.gf_high              is distinct from old.gf_high
       or new.deco_model           is distinct from old.deco_model
       or new.atmospheric_mbar     is distinct from old.atmospheric_mbar
       or new.water_type           is distinct from old.water_type
       or new.device_serial        is distinct from old.device_serial
       or new.raw_binary_url       is distinct from old.raw_binary_url
       or new.is_verified          is distinct from old.is_verified
       -- Tank pressure: only block if old value was already set by BLE.
       or (new.tank_start_bar is distinct from old.tank_start_bar
           and old.tank_start_bar is not null)
       or (new.tank_end_bar   is distinct from old.tank_end_bar
           and old.tank_end_bar   is not null)
    then
      raise exception
        '검증된 다이브의 측정 필드는 수정할 수 없습니다.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
