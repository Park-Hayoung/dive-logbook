-- Migration 004: Create the avatars Storage bucket + RLS policies.
--
-- Run this in Supabase SQL Editor. Storage buckets are managed via the
-- storage.buckets / storage.objects tables — same SQL surface as everything
-- else.

-- 1. Create the avatars bucket as public (read access).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 2. Drop any prior policies in case this migration is re-run.
drop policy if exists "Avatars are publicly readable" on storage.objects;
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;

-- 3. Public read (the bucket is public, but having an explicit SELECT policy
--    avoids any edge cases where the public flag isn't honored).
create policy "Avatars are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- 4. Authenticated users can upload only into their own folder, where the
--    first path segment equals their auth.uid().
--    Path layout: <user_uuid>/<filename>
create policy "Users can upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Same for UPDATE (used by upsert: true on re-uploads).
create policy "Users can update own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Optional cleanup of old avatars by their owner.
create policy "Users can delete own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
