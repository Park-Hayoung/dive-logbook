-- Migration 005: Create the feed-media Storage bucket + RLS policies.
--
-- Used for images attached to feeds (and later: team images, group photos).
-- Path layout: <user_uuid>/<filename> — same convention as avatars so the
-- "first folder == auth.uid()" RLS pattern can be reused.

-- 1. Create the bucket as public (read access).
insert into storage.buckets (id, name, public)
values ('feed-media', 'feed-media', true)
on conflict (id) do update set public = true;

-- 2. Drop any prior policies in case this migration is re-run.
drop policy if exists "Feed media is publicly readable" on storage.objects;
drop policy if exists "Users can upload own feed media" on storage.objects;
drop policy if exists "Users can update own feed media" on storage.objects;
drop policy if exists "Users can delete own feed media" on storage.objects;

-- 3. Public read.
create policy "Feed media is publicly readable"
on storage.objects for select
to public
using (bucket_id = 'feed-media');

-- 4. Authenticated users upload only into their own folder.
create policy "Users can upload own feed media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'feed-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Same for UPDATE.
create policy "Users can update own feed media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'feed-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'feed-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Owner cleanup.
create policy "Users can delete own feed media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'feed-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
