-- DiveLog (WOOZOO) initial schema
-- PostgreSQL on Supabase. Run via `supabase db push` or paste into SQL editor.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- ============================================================================
-- Profiles (extends auth.users)
-- ============================================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nickname        text unique not null,
  profile_image_url text,
  diving_org      text,
  certification   text,
  total_dives_at_signup int default 0,
  bio             text,
  team_id         uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================================
-- Teams
-- ============================================================================
create table public.teams (
  id          uuid primary key default uuid_generate_v4(),
  name        text unique not null,
  leader_id   uuid references public.profiles(id) on delete set null,
  description text,
  image_url   text,
  created_at  timestamptz default now()
);

create table public.team_members (
  team_id   uuid references public.teams(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  role      text not null check (role in ('leader','member','pending')),
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);

alter table public.profiles
  add constraint profiles_team_fk foreign key (team_id) references public.teams(id) on delete set null;

-- ============================================================================
-- Equipment master (normalized)
-- ============================================================================
create table public.equipment (
  id       uuid primary key default uuid_generate_v4(),
  brand    text not null,
  model    text not null,
  category text not null,
  unique (brand, model)
);

-- ============================================================================
-- Dives — core entity
-- ============================================================================
create type dive_weather as enum ('sunny','cloudy','rainy','night');

create table public.dives (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  dive_number      int not null,
  country          text not null,
  location         text not null,
  point            text,
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  duration_minutes int generated always as
                     (extract(epoch from (ended_at - started_at))::int / 60) stored,
  max_depth        numeric(5,2) not null,
  avg_depth        numeric(5,2),
  water_temp       numeric(4,1),
  visibility       int,
  weather          dive_weather,
  memo             text,
  is_verified      boolean default false,
  device_serial    text,
  raw_binary_url   text,
  thumbnail_url    text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (user_id, dive_number)
);

create index dives_user_started_idx on public.dives (user_id, started_at desc);

create table public.dive_equipment (
  dive_id      uuid references public.dives(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete restrict,
  primary key (dive_id, equipment_id)
);

create table public.dive_buddies (
  dive_id uuid references public.dives(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (dive_id, user_id)
);

create table public.dive_media (
  id          uuid primary key default uuid_generate_v4(),
  dive_id     uuid not null references public.dives(id) on delete cascade,
  storage_url text not null,
  kind        text not null check (kind in ('image','video')),
  uploaded_at timestamptz default now()
);

create index dive_media_dive_idx on public.dive_media (dive_id);

-- ============================================================================
-- Shops + bookings
-- ============================================================================
create table public.shops (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  country      text not null,
  city         text not null,
  region       text not null,
  coordinates  geography(point, 4326),
  rating       numeric(2,1) default 0,
  review_count int default 0,
  description  text,
  image_url    text,
  is_premium   boolean default false,
  created_at   timestamptz default now()
);

create index shops_location_idx on public.shops (country, city, region);
create index shops_geo_idx on public.shops using gist (coordinates);

create table public.shop_bookings (
  id           uuid primary key default uuid_generate_v4(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  people_count int not null check (people_count > 0),
  dive_kind    text,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  message      text,
  created_at   timestamptz default now()
);

-- ============================================================================
-- Feed (SNS)
-- ============================================================================
create type feed_type as enum ('log','normal','ad');

create table public.feeds (
  id              uuid primary key default uuid_generate_v4(),
  author_id       uuid not null references public.profiles(id) on delete cascade,
  type            feed_type not null,
  content         text,
  image_url       text,
  location        text,
  linked_dive_id  uuid references public.dives(id) on delete set null,
  created_at      timestamptz default now()
);

create index feeds_created_idx on public.feeds (created_at desc);

create table public.feed_likes (
  feed_id    uuid references public.feeds(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (feed_id, user_id)
);

create table public.feed_comments (
  id         uuid primary key default uuid_generate_v4(),
  feed_id    uuid not null references public.feeds(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- Follows
-- ============================================================================
create table public.follows (
  follower_id  uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ============================================================================
-- Q&A (지식인 스타일)
-- ============================================================================
create table public.qna_questions (
  id                 uuid primary key default uuid_generate_v4(),
  author_id          uuid not null references public.profiles(id) on delete cascade,
  category           text not null,
  title              text not null,
  content            text not null,
  is_urgent          boolean default false,
  accepted_answer_id uuid,
  created_at         timestamptz default now()
);

create table public.qna_answers (
  id          uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.qna_questions(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  created_at  timestamptz default now()
);

alter table public.qna_questions
  add constraint qna_questions_accepted_fk
  foreign key (accepted_answer_id) references public.qna_answers(id) on delete set null;

-- ============================================================================
-- Schedules (다가오는 다이빙)
-- ============================================================================
create table public.dive_schedules (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  start_date date not null,
  end_date   date not null,
  point      text,
  shop_id    uuid references public.shops(id) on delete set null,
  created_at timestamptz default now()
);

create table public.schedule_buddies (
  schedule_id uuid references public.dive_schedules(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  status      text not null default 'invited' check (status in ('invited','accepted','rejected')),
  primary key (schedule_id, user_id)
);

-- ============================================================================
-- Row Level Security (basic policies)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.equipment enable row level security;
alter table public.dives enable row level security;
alter table public.dive_equipment enable row level security;
alter table public.dive_buddies enable row level security;
alter table public.dive_media enable row level security;
alter table public.shops enable row level security;
alter table public.shop_bookings enable row level security;
alter table public.feeds enable row level security;
alter table public.feed_likes enable row level security;
alter table public.feed_comments enable row level security;
alter table public.follows enable row level security;
alter table public.qna_questions enable row level security;
alter table public.qna_answers enable row level security;
alter table public.dive_schedules enable row level security;
alter table public.schedule_buddies enable row level security;

-- profiles: anyone can read, only self can update
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update on public.profiles for update using (auth.uid() = id);
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);

-- dives: owner can do anything; others can read (for feed display)
create policy dives_owner_all on public.dives for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dives_read_public on public.dives for select using (true);

-- shop_bookings: owner only
create policy bookings_owner on public.shop_bookings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- feeds: owner can write/delete; everyone can read
create policy feeds_read on public.feeds for select using (true);
create policy feeds_owner on public.feeds for insert with check (auth.uid() = author_id);
create policy feeds_update on public.feeds for update using (auth.uid() = author_id);
create policy feeds_delete on public.feeds for delete using (auth.uid() = author_id);

-- feed_likes / feed_comments: similar
create policy likes_read on public.feed_likes for select using (true);
create policy likes_owner on public.feed_likes for insert with check (auth.uid() = user_id);
create policy likes_delete on public.feed_likes for delete using (auth.uid() = user_id);

create policy comments_read on public.feed_comments for select using (true);
create policy comments_owner on public.feed_comments for insert with check (auth.uid() = author_id);
create policy comments_update on public.feed_comments for update using (auth.uid() = author_id);
create policy comments_delete on public.feed_comments for delete using (auth.uid() = author_id);

-- follows: anyone can read, only self-as-follower can create/delete
create policy follows_read on public.follows for select using (true);
create policy follows_owner on public.follows for insert with check (auth.uid() = follower_id);
create policy follows_delete on public.follows for delete using (auth.uid() = follower_id);

-- teams: anyone can read (search/browse); authenticated users can create (become leader);
-- only leader can update/delete
create policy teams_read on public.teams for select using (true);
create policy teams_create on public.teams for insert
  with check (auth.uid() = leader_id);
create policy teams_update_leader on public.teams for update using (auth.uid() = leader_id);
create policy teams_delete_leader on public.teams for delete using (auth.uid() = leader_id);

-- team_members: anyone can read (to see members); user can request to join (status='pending')
-- and leave themselves; leader manages approval/removal
create policy team_members_read on public.team_members for select using (true);
create policy team_members_join on public.team_members for insert
  with check (auth.uid() = user_id);
create policy team_members_leave on public.team_members for delete
  using (
    auth.uid() = user_id
    or auth.uid() = (select leader_id from public.teams where id = team_id)
  );
create policy team_members_manage on public.team_members for update
  using (auth.uid() = (select leader_id from public.teams where id = team_id));

-- equipment: master table — anyone reads (autocomplete), authenticated users can insert
-- new entries (when adding to dives). UPDATE/DELETE locked (admin only via SQL).
create policy equipment_read on public.equipment for select using (true);
create policy equipment_insert on public.equipment for insert
  with check (auth.role() = 'authenticated');

-- shops: master table — anyone reads. INSERT/UPDATE/DELETE locked (admin curated via SQL).
create policy shops_read on public.shops for select using (true);

-- qna_questions / qna_answers: anyone reads, only owner writes
create policy qna_q_read on public.qna_questions for select using (true);
create policy qna_q_owner on public.qna_questions for insert
  with check (auth.uid() = author_id);
create policy qna_q_update on public.qna_questions for update using (auth.uid() = author_id);
create policy qna_q_delete on public.qna_questions for delete using (auth.uid() = author_id);

create policy qna_a_read on public.qna_answers for select using (true);
create policy qna_a_owner on public.qna_answers for insert
  with check (auth.uid() = author_id);
create policy qna_a_update on public.qna_answers for update using (auth.uid() = author_id);
create policy qna_a_delete on public.qna_answers for delete using (auth.uid() = author_id);

-- dive_equipment / dive_buddies / dive_media: tied to dive ownership
create policy dive_equipment_read on public.dive_equipment for select using (true);
create policy dive_equipment_owner on public.dive_equipment for all
  using (auth.uid() = (select user_id from public.dives where id = dive_id))
  with check (auth.uid() = (select user_id from public.dives where id = dive_id));

create policy dive_buddies_read on public.dive_buddies for select using (true);
create policy dive_buddies_owner on public.dive_buddies for all
  using (auth.uid() = (select user_id from public.dives where id = dive_id))
  with check (auth.uid() = (select user_id from public.dives where id = dive_id));

create policy dive_media_read on public.dive_media for select using (true);
create policy dive_media_owner on public.dive_media for all
  using (auth.uid() = (select user_id from public.dives where id = dive_id))
  with check (auth.uid() = (select user_id from public.dives where id = dive_id));

-- dive_schedules / schedule_buddies: owner manages, buddies can see schedules they're invited to
create policy schedules_owner on public.dive_schedules for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy schedules_invitee_read on public.dive_schedules for select
  using (
    auth.uid() in (select user_id from public.schedule_buddies where schedule_id = id)
  );

create policy schedule_buddies_read on public.schedule_buddies for select using (true);
create policy schedule_buddies_owner on public.schedule_buddies for all
  using (auth.uid() = (select user_id from public.dive_schedules where id = schedule_id))
  with check (auth.uid() = (select user_id from public.dive_schedules where id = schedule_id));
create policy schedule_buddies_self_update on public.schedule_buddies for update
  using (auth.uid() = user_id);

-- ============================================================================
-- Storage buckets (run separately or via dashboard)
-- ============================================================================
-- insert into storage.buckets (id, name, public) values ('dive-media', 'dive-media', true);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
