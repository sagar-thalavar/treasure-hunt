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

-- 4. Re-define the guard_claim_update trigger function
-- Allows setting `photo_url` from NULL to the path.
-- Securely restricts status changes to creators/admins only.
create or replace function public.guard_claim_update()
returns trigger as $$
declare
  treasure_creator_id uuid;
begin
  if is_admin() then
    return new;
  end if;

  select creator_id into treasure_creator_id from public.treasures where id = new.treasure_id;

  -- Block editing locked fields.
  -- ONLY allow setting photo_url if it was previously NULL.
  if (new.photo_url is distinct from old.photo_url and old.photo_url is not null)
     or new.verified_latitude is distinct from old.verified_latitude
     or new.verified_longitude is distinct from old.verified_longitude
     or new.player_id is distinct from old.player_id
     or new.treasure_id is distinct from old.treasure_id then
    raise exception 'You cannot modify these fields.';
  end if;

  -- Restrict status change to creators only
  if new.status is distinct from old.status then
    if auth.uid() is distinct from treasure_creator_id then
      raise exception 'Only the creator can approve or reject claims.';
    end if;
    if not (old.status = 'pending' and new.status in ('approved', 'rejected')) then
      raise exception 'Invalid status transition.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 5. Add update policy for players on public.claims
drop policy if exists "Players can update their own pending claims" on public.claims;
create policy "Players can update their own pending claims"
  on public.claims for update
  using (auth.uid() = player_id and status = 'pending')
  with check (auth.uid() = player_id and status = 'pending');
