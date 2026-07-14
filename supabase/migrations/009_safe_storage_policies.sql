-- ============================================================
-- FIX: Claim proof photos not showing up in creator claims tab.
--
-- The original storage policies used `(storage.foldername(name))[2]::uuid`
-- to extract the claim ID and check if the user is the player/creator.
--
-- However, if there are non-UUID folders/files in the storage bucket,
-- or if foldername returns empty, PostgreSQL will throw a syntax/cast error:
-- "ERROR: invalid input syntax for type uuid".
-- This crashes the entire signed URL query and returns null.
--
-- This migration updates the SELECT policy to use a clean text comparison
-- against `claims.photo_url` which holds the exact path (no cast needed).
-- It also updates the INSERT policy to check the folder UUID format with regex
-- before casting, avoiding any runtime errors.
-- ============================================================

-- 1. Drop existing policies
drop policy if exists "Finder can upload their own claim photo" on storage.objects;
drop policy if exists "Finder, treasure creator, or admin can view a claim photo" on storage.objects;

-- 2. Create safer SELECT policy using direct path matching
create policy "Finder, treasure creator, or admin can view a claim photo"
  on storage.objects for select
  using (
    bucket_id = 'claim-photos'
    and (
      is_admin()
      or auth.uid() = (
        select player_id from public.claims
        where photo_url = name
      )
      or auth.uid() = (
        select t.creator_id from public.claims c
        join public.treasures t on t.id = c.treasure_id
        where c.photo_url = name
      )
    )
  );

-- 3. Create safer INSERT policy checking UUID format before casting
create policy "Finder can upload their own claim photo"
  on storage.objects for insert
  with check (
    bucket_id = 'claim-photos'
    and (
      is_admin()
      or (
        -- Verify it is a valid UUID format before casting
        (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and auth.uid() = (
          select player_id from public.claims
          where id = (storage.foldername(name))[2]::uuid
        )
      )
    )
  );
