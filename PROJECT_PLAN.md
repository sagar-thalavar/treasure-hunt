# Treasure Hunt — Project Plan & Decision Log

This file is the persistent memory of this project. Chat conversations end or
run out of context — this file doesn't. Read this file at the start of any
new conversation about this project (new chat, new day, new person helping)
instead of relying on old chat history. Keep it updated as things change:
new idea that isn't being built right now → add it to Parking Lot. Firm
decision made → add it to Decisions. Nothing should live only inside a
chat transcript.

## What this is

A real-world discovery game. Someone hides a reward at a real physical
location, describes it with a photo + hints instead of exposing the exact
location, and other users have to recognize or figure out where that is,
physically go there, and prove it with a live camera photo plus their
phone's real GPS. The location is never shown publicly — only used in the
backend to verify a claim.

## Why this is expected to work

Location-based "go somewhere real to find/claim something" games have a
long track record (geocaching has run for 20+ years on this loop with no
money involved; Pokémon Go proved people will travel for small/virtual
rewards at scale). Hiding the location and requiring recognition, rather
than handing out coordinates, is a stronger hook than a plain map-pin app —
closer to a riddle than an errand.

## Current status (as of this writing)

The original build (visible map pins, instant GPS claim, no photos) has
been replaced in concept by the design below. The v1 spec is now locked
(see below) and implementation is starting. This section should get
updated as pieces actually get built, so anyone picking this file up
mid-build knows what's real code vs. still just a plan.

## v1 scope — LOCKED

Locked via a step-by-step Q&A walkthrough with Sagar, screen by screen.
Nothing below should expand mid-build — new ideas go in Parking Lot instead.

### 1. Create Treasure screen
- Fields: short title, one clue photo, one free-text hint, location pin
  (dropped on a map, stored hidden — never shown publicly), points to
  stake (numeric, capped at the creator's current balance).
- No reward-type selector for v1 — points only. No expiry date.
- On submit, goes into the admin approval queue (see below), not live yet.

### 2. Discovery feed
- Single-column scroll, one treasure per post (Instagram-home-feed style,
  not a grid).
- Each card shows photo + title + points value up front. Tapping opens
  the hint text and full details.
- A treasure that's been successfully claimed stays visible in the feed,
  marked "Found" (not removed).
- Has a filter/sort by points value.

### 3. Claim flow (finder's side)
- On a treasure's detail page, live GPS distance tracking (already built)
  shows how close the finder is.
- The claim button stays disabled until GPS confirms they're within the
  treasure's radius — same gating logic as the existing distance tracker.
- Once enabled, the finder can either take a live photo through an in-app
  webcam view (back camera, with a preview + retake option before
  submitting) or upload one from their gallery — both options offered
  (revised from the original camera-only plan; reuses the working webcam
  capture code from the guestbook project, just flipped to the back
  camera).
- Submitting sends the photo + GPS coordinates + timestamp to the
  treasure's creator for review.
- The finder sees a persistent "pending review" status, both on the
  treasure page and in their own profile/activity — not just a one-time
  toast.

### 4. Creator's Claims inbox
- A dedicated "Claims" section (not buried in the profile) listing every
  pending claim across all of a creator's treasures.
- Each entry shows the claim photo, the finder's username, and the
  treasure it's for.
- Approve / Reject actions. Rejecting requires a short reason, shown to
  the finder.
- An in-app badge/count shows how many claims are waiting on the creator.
- If the creator doesn't respond within ~48 hours, the claim auto-approves
  (safety net against an inactive or bad-faith creator).
- A rejected claim does NOT remove the treasure — it stays live in the
  feed for other people to still attempt.
- For v1, at this small pilot scale, a finder who feels wrongly rejected
  can just message Sagar directly outside the app — a formal in-app
  appeal/dispute flow is parked for later (see Parking Lot).

### 5. Admin treasure-approval queue
- Admin access controlled by a `role` field on the creator's profile
  (not hardcoded to one email) — lets a second moderator be added later
  without a code change.
- Lists every pending treasure submission with photo, title, hint,
  creator, points staked, AND the real hidden location — admin needs to
  see the actual location to judge if it's genuine, safe, and appropriate.
- Approve / Reject actions. Rejecting requires a reason, shown to the
  creator, who can then edit that same submission and resend it (not
  start over from scratch).

### 6. Points economy rules
- Every account starts with 500 points on signup.
- Creating a treasure stakes points from the creator's balance immediately,
  capped at their current balance (can never go negative).
- If admin rejects a submission, the staked points are refunded
  immediately. Resubmitting after an edit re-stakes the same amount
  (assuming the balance still allows it).
- If a creator withdraws/deletes a live treasure that nobody has
  successfully claimed yet, the remaining staked points are refunded.
- Rejecting an individual claim attempt does NOT refund the stake — the
  treasure is still live and valid, just that one attempt didn't pan out.
- A creator cannot claim their own treasure (blocked outright).
- When a claim is approved (by the creator, or via the 48-hour timeout),
  the staked points transfer to the finder.
- Still no real-money buying or cashing out of points in v1.

### 7. Auth model (revised)
- Switched from password + email-confirmation signup to passwordless
  magic-link email sign-in + Google OAuth — no password to manage, and no
  separate confirmation step that can fail cross-browser. Reuses the
  pattern from Sagar's guestbook project (see Reusable Prior Work below).

### 8. Image storage
- Treasure clue photos stay in a public bucket (they're meant to be seen
  in the feed by anyone).
- Claim photos (proof of physical presence) go in a separate, private/
  restricted bucket, accessed only via short-lived signed URLs — not
  public links. Same pattern as the guestbook project's selfie storage.
- Both buckets live in the treasure hunt's existing Supabase project
  (the one already configured in `.env.local`) — no separate database
  needed, just an additional private bucket in the same project.

## Reusable prior work — github.com/sagar-thalavar/guestbook

Sagar has an existing, deployed project (a visitor "guestbook" on his
portfolio site) that already solved several pieces we need. Only the
public code was reviewed (cloned from GitHub) — no live credentials or
database access to that project. Patterns being reused:

- **Notifications**: a Supabase DB webhook → Edge Function → Resend API
  pattern. Fires on insert (notify admin of new submission) and on status
  change (notify submitter of approval/rejection with a reason). Maps
  directly onto both our admin treasure-approval queue and creator
  claim-approval queue.
- **Auth**: Google OAuth + passwordless magic-link email sign-in via
  Supabase, avoiding the password+confirmation-link flow entirely.
- **Camera**: an in-app webcam capture component (`getUserMedia` + canvas
  snapshot), built for front-camera selfies — being adapted to the back
  camera for photographing a treasure, alongside a gallery-upload option.
- **Schema/RLS shape**: a `role` column on profiles with an `is_admin()`
  helper function, a `pending/approved/rejected` status enum with
  rejection-reason tracking and a resubmission-attempt counter, and an
  audit log table of moderator actions. This is close to a direct
  blueprint for both of our moderation queues.
- **Storage**: private/restricted buckets with short-lived signed URLs
  for sensitive images, rather than public URLs.

To actually wire up real email sending, Sagar needs to add a Resend API
key and the Supabase service role key as secrets in the Supabase
dashboard for this project directly (not pasted into chat — the service
role key bypasses all Row Level Security and should be treated carefully).

### Scope boundary
Bangalore only, small pilot group (Sagar + friends), not public, not
marketed.

## Decisions made (with reasoning, so we don't relitigate them)

- **Location stays hidden, always.** Showing the pin defeats the
  recognition mechanic — this was the whole reason for the redesign.
- **Camera-only capture is a soft rule, not a hard guarantee.** A browser
  can't 100% prevent someone from faking a photo. Because of this, rewards
  should stay low-stakes (points, not real money/prizes) until there's
  real usage data on how often people actually try to cheat.
- **GPS accuracy is ~5–20m outdoors, worse near tall buildings.** Default
  claim radius should be generous (closer to 100m+), not tight — a tight
  radius fights GPS reality more than it fights cheating. The existing
  radius slider (10–500m) already supports this; just default toward the
  looser end.
- **Points are staked/escrowed at creation, not silently refunded on
  rejection.** If a creator could reject a claim and just get their points
  back for free, "reject everything" becomes a way to never actually risk
  anything, which breaks trust in the whole system.
- **Claims auto-approve after ~48 hours of creator inactivity.** Protects
  finders from a creator who goes silent or acts in bad faith. Finders can
  also appeal a rejection to Sagar (the sole admin, for now) for a manual
  override.
- **Treasure submissions need a real in-app admin screen**, not just
  manually editing rows in the Supabase dashboard — one page, visible only
  to Sagar's account, listing pending items with approve/reject.
- **Monetization is explicitly deferred.** When it eventually matters, the
  realistic path is businesses/sponsors funding treasure rewards for foot
  traffic (B2B), not individual players buying points for personal fun
  (B2C) — there's no reason to design or build anything for this yet.
- **Pilot area should be neighborhood-sized, not one building and not all
  of Bangalore.** One building is too trivial (everyone already knows every
  inch of it — no real hunt). All of Bangalore with a handful of friends is
  too sparse (treasures never get stumbled onto). A single recognizable
  area with some real size — a park + surrounding streets, a campus, a
  market stretch — is the right test scale. The already-seeded Bangalore
  landmark sample treasures (Lalbagh, Cubbon Park, Vidhana Soudha, etc.)
  are a natural fit for this once reshaped to use a clue photo + hidden
  location instead of exposed coordinates.

## Parking lot — raised, deliberately NOT being built right now

Anything here should stay here until it's explicitly pulled back into
scope in conversation — don't build it just because it's on this list.

- Real-money points purchase or cash-out, and the fraud/KYC work that
  would require.
- Automated moderation (to reduce manual review load as volume grows).
- Business/sponsor-funded treasure rewards (the actual monetization path,
  once there's a real audience).
- Expanding beyond Bangalore.
- Any scaling/infrastructure work beyond a small friend-group pilot.
- Multiple/progressive staged hints (v1 is one hint only).
- A "misc reward" placeholder UI for future reward types beyond points.
- A formal in-app appeal/dispute flow for rejected claims (v1 handles
  this by messaging Sagar directly, outside the app).

## Open questions (need an actual answer before/while building)

- Which specific area in Bangalore is the first real pilot zone?
- Exact default claim radius number (decided to be generous, ~100m+, but
  not pinned to a specific figure yet).

## Known technical bugs already fixed in the old codebase

(Kept for reference — these fixes still apply regardless of the redesign
above: TypeScript build errors blocking deployment, missing mobile
viewport tag, redundant per-page Supabase auth checks slowing down page
navigation, LeafletPicker not recentering to live GPS location, email
confirmation failing cross-browser on mobile, and a signup bug where two
accounts sharing a display name would crash profile creation entirely.)
