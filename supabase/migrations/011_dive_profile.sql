-- Migration 011: Dive profile, gas mixes, dive style/conditions
-- Adds fields needed for Shearwater BLE auto-import (gas, tank pressure,
-- deco model) plus user-entered conditions (boat/shore, drift/wreck/night,
-- current strength, surface interval) and a depth-time profile sample table
-- for the dive profile graph.
--
-- Note: lat/lng/place_id were already added by 010_dive_location_coords.sql.
-- All add column / create are idempotent so partial reruns are safe.

-- ============================================================================
-- Conditions + tank/gas summary on the dive row
-- ============================================================================
alter table public.dives
  add column if not exists dive_mode               text,
  add column if not exists entry_type              text,
  add column if not exists dive_style              text[],
  add column if not exists current_strength        text,
  add column if not exists surface_interval_min    int,
  add column if not exists gf_low                  int,
  add column if not exists gf_high                 int,
  add column if not exists deco_model              text,
  add column if not exists atmospheric_mbar        int,
  add column if not exists water_type              text,
  add column if not exists tank_start_bar          numeric(5,1),
  add column if not exists tank_end_bar            numeric(5,1),
  add column if not exists tank_volume_l           numeric(4,1),
  add column if not exists tank_serial             text,
  add column if not exists consumption_bar_per_min numeric(5,1),
  add column if not exists sac_l_per_min           numeric(4,1);

-- Constraints — separate so they can be added once even after partial rerun.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dives_entry_type_check') then
    alter table public.dives
      add constraint dives_entry_type_check
      check (entry_type is null or entry_type in ('boat','shore','liveaboard'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'dives_current_strength_check') then
    alter table public.dives
      add constraint dives_current_strength_check
      check (current_strength is null or current_strength in ('none','mild','moderate','strong'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'dives_water_type_check') then
    alter table public.dives
      add constraint dives_water_type_check
      check (water_type is null or water_type in ('fresh','salt'));
  end if;
end$$;

-- ============================================================================
-- Gas mixes per dive (multiple gases for tec diving; single Air for rec)
-- ============================================================================
create table if not exists public.dive_gas_mixes (
  id         uuid primary key default uuid_generate_v4(),
  dive_id    uuid not null references public.dives(id) on delete cascade,
  mix_index  int  not null,
  o2_pct     int  not null check (o2_pct between 0 and 100),
  he_pct     int  not null default 0 check (he_pct between 0 and 100),
  is_diluent boolean default false,
  unique (dive_id, mix_index)
);
create index if not exists dive_gas_mixes_dive_idx on public.dive_gas_mixes (dive_id);

-- ============================================================================
-- Dive profile samples (depth-time series)
-- ============================================================================
create table if not exists public.dive_samples (
  id           uuid primary key default uuid_generate_v4(),
  dive_id      uuid not null references public.dives(id) on delete cascade,
  time_s       int  not null,
  depth_m      numeric(5,2) not null,
  temp_c       numeric(4,1),
  ndl_deco_min int,
  tts_min      int,
  deco_stop_m  numeric(4,1),
  tank0_bar    numeric(5,1),
  tank1_bar    numeric(5,1),
  cns          numeric(4,2)
);
create index if not exists dive_samples_dive_time_idx on public.dive_samples (dive_id, time_s);

-- ============================================================================
-- RLS — mirror dives ownership
-- ============================================================================
alter table public.dive_gas_mixes enable row level security;
alter table public.dive_samples   enable row level security;

drop policy if exists dive_gas_mixes_read  on public.dive_gas_mixes;
drop policy if exists dive_gas_mixes_owner on public.dive_gas_mixes;
create policy dive_gas_mixes_read on public.dive_gas_mixes
  for select using (true);
create policy dive_gas_mixes_owner on public.dive_gas_mixes
  for all
  using (auth.uid() = (select user_id from public.dives where id = dive_id))
  with check (auth.uid() = (select user_id from public.dives where id = dive_id));

drop policy if exists dive_samples_read  on public.dive_samples;
drop policy if exists dive_samples_owner on public.dive_samples;
create policy dive_samples_read on public.dive_samples
  for select using (true);
create policy dive_samples_owner on public.dive_samples
  for all
  using (auth.uid() = (select user_id from public.dives where id = dive_id))
  with check (auth.uid() = (select user_id from public.dives where id = dive_id));
