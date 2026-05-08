-- Migration 012: Tamper-proofing for BLE-imported dives.
-- Prevents UPDATE of fields that came from the dive computer when
-- is_verified=true. Client UI also disables these fields, but the trigger is
-- defense-in-depth against direct PostgREST manipulation.
--
-- Locked columns (only blocked when old.is_verified = true):
--   started_at, ended_at, max_depth, avg_depth, water_temp,
--   tank_start_bar, tank_end_bar, consumption_bar_per_min,
--   dive_mode, gf_low, gf_high, deco_model, atmospheric_mbar, water_type,
--   device_serial, raw_binary_url, is_verified
--
-- duration_minutes is a generated column (started_at..ended_at) so it follows
-- automatically. lat/lng/place_id stay editable — even on imported dives the
-- user is expected to set the dive site location after import.

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
       or new.tank_start_bar       is distinct from old.tank_start_bar
       or new.tank_end_bar         is distinct from old.tank_end_bar
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
    then
      raise exception
        '검증된 다이브의 측정 필드는 수정할 수 없습니다.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists dives_protect_verified_trigger on public.dives;
create trigger dives_protect_verified_trigger
  before update on public.dives
  for each row execute function public.dives_protect_verified();

-- Also protect dive_samples and dive_gas_mixes — these are only written by the
-- BLE import flow. Block any UPDATE/INSERT/DELETE of samples/gas_mixes whose
-- parent dive is verified, since those are device-measured time series.
create or replace function public.dive_samples_protect_verified()
returns trigger
language plpgsql
as $$
declare
  parent_verified boolean;
  parent_id uuid;
begin
  parent_id := coalesce(new.dive_id, old.dive_id);
  select is_verified into parent_verified from public.dives where id = parent_id;
  if parent_verified is true and tg_op <> 'INSERT' then
    raise exception
      '검증된 다이브의 시계열 샘플은 변경할 수 없습니다.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists dive_samples_protect_trigger on public.dive_samples;
create trigger dive_samples_protect_trigger
  before update or delete on public.dive_samples
  for each row execute function public.dive_samples_protect_verified();

drop trigger if exists dive_gas_mixes_protect_trigger on public.dive_gas_mixes;
create trigger dive_gas_mixes_protect_trigger
  before update or delete on public.dive_gas_mixes
  for each row execute function public.dive_samples_protect_verified();
