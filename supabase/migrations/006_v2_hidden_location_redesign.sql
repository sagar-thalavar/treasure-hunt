-- ============================================================
-- V2 REDESIGN: hidden-location discovery game
--
-- Adds: admin roles, a points economy (stake/refund/transfer),
-- a two-stage moderation workflow (admin approves treasures,
-- creators approve claims), and claim-photo support.
--
-- Run this AFTER 001-005 in the Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- PROFILES: role + points balance
-- ============================================================
alter table profiles add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

alter table profiles add column if not exists points_balance integer not null default 500
  check (points_balance >= 0);

-- Helper used throughout: is the current requester an admin?
create or replace function is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- TREASURES: relax old required fields no longer collected at
-- creation, add moderation + staking + hint + "Found" state
-- ============================================================
alter table treasures alter column description drop not null;
alter table treasures alter column reward_type drop not null;
alter table treasures alter column reward_description drop not null;

alter table treasures add column if not exists hint text;
alter table treasures add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));
alter table treasures add column if not exists rejection_reason text;
alter table treasures add column if not exists points_staked integer not null default 0
  check (points_staked >= 0);
alter table treasures add column if not exists claimed_by uuid references profiles(id);
alter table treasures add column if not exists claimed_at timestamptz;

-- Replace old visibility-based RLS with status-based RLS.
drop policy if exists "Public treasures viewable by authenticated users." on treasures;
drop policy if exists "Private treasures viewable by creator." on treasures;

create policy "Approved, active treasures viewable by authenticated users."
  on treasures for select
  using (auth.uid() is not null and status = 'approved' and is_active = true);

create policy "Creators can view their own treasures regardless of status."
  on treasures for select
  using (auth.uid() = creator_id);

create policy "Admins can view all treasures."
  on treasures for select
  using (is_admin());

create policy "Admins can update any treasure."
  on treasures for update
  using (is_admin());

-- Guard: creators can still update their own row (e.g. withdraw it, or
-- resubmit after a rejection), but cannot directly tamper with
-- moderation/staking fields that only the system or an admin should set.
create or replace function guard_treasure_update()
returns trigger as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.claimed_by is distinct from old.claimed_by
     or new.claimed_at is distinct from old.claimed_at
     or new.points_staked is distinct from old.points_staked then
    raise exception 'You cannot modify these fields directly.';
  end if;

  if new.status is distinct from old.status
     and not (old.status = 'rejected' and new.status = 'pending') then
    raise exception 'Only an admin can change a treasure''s approval status.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_treasure_update_guard on treasures;
create trigger on_treasure_update_guard
  before update on treasures
  for each row execute procedure guard_treasure_update();

-- Stake points when a treasure is first created (capped at balance).
create or replace function stake_points_on_treasure_insert()
returns trigger as $$
declare
  current_balance integer;
begin
  select points_balance into current_balance from profiles where id = new.creator_id;
  if current_balance is null or new.points_staked > current_balance then
    raise exception 'Insufficient points balance to stake this amount.';
  end if;
  update profiles set points_balance = points_balance - new.points_staked where id = new.creator_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_treasure_insert_stake on treasures;
create trigger on_treasure_insert_stake
  before insert on treasures
  for each row execute procedure stake_points_on_treasure_insert();

-- Refund stake immediately on admin rejection; re-stake on resubmission.
create or replace function handle_treasure_status_change()
returns trigger as $$
begin
  if new.status = 'rejected' and old.status is distinct from 'rejected' then
    update profiles set points_balance = points_balance + new.points_staked where id = new.creator_id;
  end if;

  if old.status = 'rejected' and new.status = 'pending' then
    if (select points_balance from profiles where id = new.creator_id) < new.points_staked then
      raise exception 'Insufficient points balance to resubmit this stake.';
    end if;
    update profiles set points_balance = points_balance - new.points_staked where id = new.creator_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_treasure_status_change on treasures;
create trigger on_treasure_status_change
  after update on treasures
  for each row execute procedure handle_treasure_status_change();

-- Refund remaining stake if a creator withdraws a live, unclaimed treasure.
create or replace function refund_points_on_withdrawal()
returns trigger as $$
begin
  if new.is_active = false and old.is_active = true and new.claimed_by is null then
    update profiles set points_balance = points_balance + new.points_staked where id = new.creator_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_treasure_withdrawal on treasures;
create trigger on_treasure_withdrawal
  after update on treasures
  for each row execute procedure refund_points_on_withdrawal();

-- ============================================================
-- CLAIMS: photo + moderation workflow
-- ============================================================
alter table claims add column if not exists photo_url text;
alter table claims add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));
alter table claims add column if not exists rejection_reason text;
alter table claims add column if not exists reviewed_at timestamptz;

create policy "Creators can update claims on their own treasures."
  on claims for update
  using (auth.uid() = (select creator_id from treasures where id = treasure_id));

-- Block a creator from claiming their own treasure (defense in depth,
-- not just a UI restriction).
create or replace function prevent_self_claim()
returns trigger as $$
begin
  if new.player_id = (select creator_id from treasures where id = new.treasure_id) then
    raise exception 'You cannot claim your own treasure.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_claim_before_insert on claims;
create trigger on_claim_before_insert
  before insert on claims
  for each row execute procedure prevent_self_claim();

-- Guard: only allow the pending -> approved/rejected transition, and only
-- on the fields that should actually change during a review.
create or replace function guard_claim_update()
returns trigger as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.photo_url is distinct from old.photo_url
     or new.verified_latitude is distinct from old.verified_latitude
     or new.verified_longitude is distinct from old.verified_longitude
     or new.player_id is distinct from old.player_id
     or new.treasure_id is distinct from old.treasure_id then
    raise exception 'You cannot modify these fields.';
  end if;

  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status in ('approved', 'rejected')) then
    raise exception 'Invalid status transition.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_claim_update_guard on claims;
create trigger on_claim_update_guard
  before update on claims
  for each row execute procedure guard_claim_update();

-- IMPORTANT: the original schema's award_xp_on_claim trigger fired on
-- INSERT, which made sense when a claim was an instant, already-verified
-- find. Now a claim starts out "pending" and isn't a real find until
-- someone approves it, so that trigger would hand out XP before any
-- review happened. Remove it — XP is now awarded alongside points, only
-- on approval, as part of handle_claim_status_change() below.
drop trigger if exists on_claim_created on claims;

-- On approval: transfer the staked points + XP to the finder and mark
-- the treasure as "Found". On rejection: just stamp reviewed_at.
create or replace function handle_claim_status_change()
returns trigger as $$
declare
  treasure_stake integer;
  xp_gain integer := 50;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select points_staked into treasure_stake from treasures where id = new.treasure_id;

    update profiles
    set
      points_balance = points_balance + treasure_stake,
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

    update treasures
    set claimed_by = new.player_id, claimed_at = now()
    where id = new.treasure_id;

    new.reviewed_at = now();
  end if;

  if new.status = 'rejected' and old.status is distinct from 'rejected' then
    new.reviewed_at = now();
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_claim_status_change on claims;
create trigger on_claim_status_change
  before update on claims
  for each row execute procedure handle_claim_status_change();

-- Safety net: auto-approve any claim that's sat pending for 48+ hours,
-- protecting finders from an inactive or bad-faith creator. Called
-- opportunistically from the app (not a real cron job) since v1 is a
-- small pilot group — good enough for now, revisit if it isn't.
create or replace function auto_approve_stale_claims()
returns void as $$
begin
  update claims
  set status = 'approved'
  where status = 'pending'
    and created_at < now() - interval '48 hours';
end;
$$ language plpgsql security definer;

-- ============================================================
-- STORAGE: private bucket for claim photos (proof of presence)
--
-- Manual step required: in the Supabase Dashboard -> Storage, create a
-- bucket named "claim-photos" and leave it PRIVATE (do not toggle public).
-- Upload path convention used by the app: {treasure_id}/{claim_id}/photo.jpg
-- (the claims row is created first with photo_url null, then the photo is
-- uploaded to this path, then photo_url is updated to match.)
-- ============================================================
create policy "Finder can upload their own claim photo"
  on storage.objects for insert
  with check (
    bucket_id = 'claim-photos'
    and auth.uid() = (
      select player_id from claims where id = (storage.foldername(name))[2]::uuid
    )
  );

create policy "Finder, treasure creator, or admin can view a claim photo"
  on storage.objects for select
  using (
    bucket_id = 'claim-photos'
    and (
      is_admin()
      or auth.uid() = (select player_id from claims where id = (storage.foldername(name))[2]::uuid)
      or auth.uid() = (select creator_id from treasures where id = (storage.foldername(name))[1]::uuid)
    )
  );

-- ============================================================
-- MANUAL STEP: make yourself an admin
--
-- Sign up / log in at least once first (so your profile row exists),
-- then run this with YOUR email in place of the placeholder below:
--
--   update profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
--
-- ============================================================
