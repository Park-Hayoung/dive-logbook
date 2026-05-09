-- Comment likes for feed comments
create table public.feed_comment_likes (
  comment_id uuid references public.feed_comments(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

create index feed_comment_likes_comment_idx
  on public.feed_comment_likes (comment_id);

alter table public.feed_comment_likes enable row level security;

create policy feed_comment_likes_read
  on public.feed_comment_likes for select using (true);

create policy feed_comment_likes_owner
  on public.feed_comment_likes for insert with check (auth.uid() = user_id);

create policy feed_comment_likes_delete
  on public.feed_comment_likes for delete using (auth.uid() = user_id);
