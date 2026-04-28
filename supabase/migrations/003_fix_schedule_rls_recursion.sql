-- Migration 003: Fix infinite recursion in dive_schedules / schedule_buddies RLS
--
-- The original migration 001 created cross-referencing policies:
--   dive_schedules.schedules_invitee_read    → SELECT from schedule_buddies
--   schedule_buddies.schedule_buddies_owner  → SELECT from dive_schedules
--
-- Postgres rejects this with "infinite recursion detected in policy for relation".
-- We break the cycle by routing the cross-table checks through SECURITY DEFINER
-- helper functions, which run with the function owner's rights and bypass RLS.

-- 1. Drop the offending policies
drop policy if exists schedules_invitee_read on public.dive_schedules;
drop policy if exists schedule_buddies_owner on public.schedule_buddies;

-- 2. Helper functions (bypass RLS via SECURITY DEFINER + locked search_path)
create or replace function public.is_schedule_owner(schedule_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.dive_schedules
    where id = schedule_uuid and user_id = auth.uid()
  );
$$;

create or replace function public.is_schedule_invitee(schedule_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.schedule_buddies
    where schedule_id = schedule_uuid and user_id = auth.uid()
  );
$$;

-- 3. Re-create policies using the helpers (no direct cross-references)
create policy schedules_invitee_read on public.dive_schedules for select
  using (public.is_schedule_invitee(id));

create policy schedule_buddies_owner on public.schedule_buddies for all
  using (public.is_schedule_owner(schedule_id))
  with check (public.is_schedule_owner(schedule_id));
