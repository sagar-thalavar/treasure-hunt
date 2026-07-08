-- ============================================================
-- TREASURE HUNT - Initial Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";  -- optional: for geo queries

-- ============================================================
-- ENUMS
-- ============================================================
create type reward_type as enum (
  'cash', 'coupon', 'collectible', 'digital', 'badge',
  'premium', 'discount_code', 'physical', 'xp'
);

create type difficulty_level as enum ('easy', 'medium', 'hard', 'legendary');
create type visibility_type as enum ('public', 'private');

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id            uuid references auth.users on delete cascade primary key,
  username      text unique not null,
  avatar_url    text,
  bio           text,
  level         integer not null default 1,
  xp            integer not null default 0,
  coins         integer not null default 0,
  reputation    integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select using (true);

create policy "Users can insert their own profile."
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile."
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- TREASURES
-- ============================================================
create table treasures (
  id                  uuid primary key default uuid_generate_v4(),
  creator_id          uuid references profiles(id) on delete cascade not null,
  title               text not null,
  description         text not null,
  reward_type         reward_type not null,
  reward_description  text not null,
  reward_value        numeric(10,2),
  latitude            double precision not null,
  longitude           double precision not null,
  difficulty          difficulty_level not null default 'easy',
  radius_meters       integer not null default 50,
  expiry_date         timestamptz,
  image_url           text,
  visibility          visibility_type not null default 'public',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

alter table treasures enable row level security;

create policy "Public treasures viewable by authenticated users."
  on treasures for select
  using (
    auth.uid() is not null
    and visibility = 'public'
    and is_active = true
    and (expiry_date is null or expiry_date > now())
  );

create policy "Private treasures viewable by creator."
  on treasures for select
  using (auth.uid() = creator_id);

create policy "Authenticated users can create treasures."
  on treasures for insert
  with check (auth.uid() = creator_id);

create policy "Creators can update their own treasures."
  on treasures for update
  using (auth.uid() = creator_id);

create policy "Creators can delete their own treasures."
  on treasures for delete
  using (auth.uid() = creator_id);

-- Index for geo proximity queries
create index treasures_location_idx on treasures (latitude, longitude);
create index treasures_active_idx on treasures (is_active, visibility);

-- ============================================================
-- CLAIMS
-- ============================================================
create table claims (
  id                  uuid primary key default uuid_generate_v4(),
  treasure_id         uuid references treasures(id) on delete cascade not null,
  player_id           uuid references profiles(id) on delete cascade not null,
  verification_method text not null default 'gps',
  verified_latitude   double precision not null,
  verified_longitude  double precision not null,
  claimed_at          timestamptz not null default now(),
  unique(treasure_id, player_id)  -- one claim per player per treasure
);

alter table claims enable row level security;

create policy "Players can view their own claims."
  on claims for select
  using (auth.uid() = player_id);

create policy "Creators can view claims on their treasures."
  on claims for select
  using (
    auth.uid() = (select creator_id from treasures where id = treasure_id)
  );

create policy "Authenticated users can create claims."
  on claims for insert
  with check (auth.uid() = player_id);

-- Award XP on claim
create or replace function award_xp_on_claim()
returns trigger as $$
declare
  xp_gain integer := 50;
begin
  update profiles
  set
    xp = xp + xp_gain,
    level = case
      when (xp + xp_gain) >= 6000 then 7
      when (xp + xp_gain) >= 3000 then 6
      when (xp + xp_gain) >= 1500 then 5
      when (xp + xp_gain) >= 700  then 4
      when (xp + xp_gain) >= 300  then 3
      when (xp + xp_gain) >= 100  then 2
      else 1
    end
  where id = new.player_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_claim_created
  after insert on claims
  for each row execute procedure award_xp_on_claim();

-- ============================================================
-- BADGES
-- ============================================================
create table badges (
  id              uuid primary key default uuid_generate_v4(),
  name            text unique not null,
  description     text not null,
  image_url       text,
  condition_type  text not null,   -- 'claims', 'creates', 'level', 'streak'
  condition_value integer not null
);

create table player_badges (
  player_id   uuid references profiles(id) on delete cascade,
  badge_id    uuid references badges(id) on delete cascade,
  earned_at   timestamptz not null default now(),
  primary key (player_id, badge_id)
);

alter table badges enable row level security;
alter table player_badges enable row level security;

create policy "Badges viewable by everyone." on badges for select using (true);
create policy "Player badges viewable by owner." on player_badges for select using (auth.uid() = player_id);

-- Seed default badges
insert into badges (name, description, condition_type, condition_value) values
  ('First Find',      'Claim your very first treasure',           'claims',  1),
  ('Explorer',        'Claim 10 treasures',                       'claims',  10),
  ('Adventurer',      'Claim 50 treasures',                       'claims',  50),
  ('Legend',          'Claim 100 treasures',                      'claims',  100),
  ('Cartographer',    'Create your first treasure',               'creates', 1),
  ('Treasure Master', 'Create 10 treasures',                      'creates', 10),
  ('Level Up',        'Reach Explorer level',                     'level',   3),
  ('Elite',           'Reach Master Explorer level',              'level',   5);

-- ============================================================
-- LEADERBOARD VIEW
-- ============================================================
create or replace view leaderboard as
select
  row_number() over (order by p.xp desc) as rank,
  p.id as player_id,
  p.username,
  p.avatar_url,
  p.xp,
  p.level,
  count(c.id) as claim_count
from profiles p
left join claims c on c.player_id = p.id
group by p.id, p.username, p.avatar_url, p.xp, p.level
order by p.xp desc;

-- ============================================================
-- STORAGE BUCKETS
-- (run in Supabase dashboard or Storage section)
-- ============================================================
-- Create bucket 'treasure-images' with public access
-- insert into storage.buckets (id, name, public) values ('treasure-images', 'treasure-images', true);
