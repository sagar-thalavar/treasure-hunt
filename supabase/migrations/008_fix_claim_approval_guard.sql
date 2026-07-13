-- ============================================================
-- Fix: a creator approving a claim fails with "You cannot modify
-- these fields directly."
--
-- Approving a claim (guard_claim_update allows pending -> approved for
-- the creator) fires handle_claim_status_change(), which as part of the
-- payout does `update treasures set claimed_by, claimed_at` to mark the
-- treasure Found. That cascaded update trips guard_treasure_update(),
-- which only checked is_admin() — the approver is the creator, not an
-- admin, so the exception rolled back the whole approval. Rejection
-- never touches the treasure row, which is why only Approve broke.
--
-- pg_trigger_depth() > 1 means the update was issued from inside
-- another trigger (the system's own cascade) rather than directly by a
-- user request, so it's safe to let through. Direct user updates always
-- run at depth 1 and stay fully guarded. This also unblocks
-- auto_approve_stale_claims(), which hits the same cascade.
-- ============================================================

create or replace function guard_treasure_update()
returns trigger as $$
begin
  if is_admin() or pg_trigger_depth() > 1 then
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

-- Trigger already points at this function (006) — replacing the body is enough.
