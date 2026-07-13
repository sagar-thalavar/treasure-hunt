-- ============================================================
-- Fix: signup fails with "duplicate key value violates unique
-- constraint profiles_username_key" whenever two accounts share the
-- same display name (e.g. one Google sign-in + one email sign-up for
-- the same person, or two different people with the same name).
--
-- The original handle_new_user() trigger inserted the profile's
-- username straight from the account's full name / email prefix with
-- no collision check, and profiles.username is UNIQUE — so the second
-- matching signup would fail the insert, which rolls back the entire
-- auth.users row too (the account never gets created at all).
--
-- This replaces the trigger with one that appends 1, 2, 3... to the
-- username until it finds one that isn't taken yet.
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1),
    'explorer'
  );
  final_username := base_username;

  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, avatar_url)
  values (new.id, final_username, new.raw_user_meta_data->>'avatar_url');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger already points at this function (created in 001_initial_schema.sql)
-- so no need to recreate it — replacing the function body is enough.
