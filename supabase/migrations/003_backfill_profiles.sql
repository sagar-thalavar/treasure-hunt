-- ============================================================
-- Backfill profiles for users who signed up before the schema
-- was created (the trigger only fires for NEW users).
-- Safe to run multiple times — skips users who already have a profile,
-- and de-duplicates usernames the same way handle_new_user() does
-- (see 005_fix_username_uniqueness.sql), so it won't fail with
-- "duplicate key value violates unique constraint profiles_username_key"
-- when two accounts share the same display name.
-- ============================================================

do $$
declare
  au record;
  base_username text;
  final_username text;
  suffix int;
begin
  for au in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    left join profiles p on p.id = u.id
    where p.id is null
  loop
    base_username := coalesce(
      nullif(trim(au.raw_user_meta_data->>'full_name'), ''),
      split_part(au.email, '@', 1),
      'explorer'
    );
    final_username := base_username;
    suffix := 0;

    while exists (select 1 from profiles where username = final_username) loop
      suffix := suffix + 1;
      final_username := base_username || suffix::text;
    end loop;

    insert into profiles (id, username, avatar_url)
    values (au.id, final_username, au.raw_user_meta_data->>'avatar_url');
  end loop;
end $$;

-- Verify
select id, username from profiles;
