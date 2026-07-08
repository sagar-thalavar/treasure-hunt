-- ============================================================
-- Sample treasures at famous Bangalore landmarks (testing/demo data)
-- Run this AFTER you have at least one account signed up — the
-- treasures are attributed to the first registered profile, since every
-- treasure row requires a valid creator_id.
-- Safe to re-run: skips seeding if it already ran once.
-- ============================================================

do $$
declare
  system_creator uuid;
begin
  select id into system_creator from profiles order by created_at asc limit 1;

  if system_creator is null then
    raise notice 'No profiles found yet — sign up at least one account, then re-run this migration.';
    return;
  end if;

  if exists (select 1 from treasures where title = 'Lalbagh''s Hidden Bloom') then
    raise notice 'Bangalore sample treasures already seeded — skipping.';
    return;
  end if;

  insert into treasures
    (creator_id, title, description, reward_type, reward_description, reward_value,
     latitude, longitude, difficulty, radius_meters, visibility, is_active)
  values
    (system_creator, 'Lalbagh''s Hidden Bloom',
     'Somewhere near the Glass House in Lalbagh Botanical Garden, a small token is waiting for a sharp-eyed explorer.',
     'xp', 'Bonus XP + a shoutout on the leaderboard', null, 12.9507, 77.5848, 'easy', 100, 'public', true),

    (system_creator, 'Cubbon Park Trailmark',
     'Hidden along one of the walking trails in Cubbon Park, close to the State Central Library.',
     'badge', 'Exclusive "Park Ranger" badge', null, 12.9763, 77.5929, 'easy', 80, 'public', true),

    (system_creator, 'The Palace Secret',
     'Somewhere on the grounds of Bangalore Palace lies a clue fit for royalty.',
     'coupon', 'Free palace grounds photo-walk voucher', 200, 12.9987, 77.5920, 'medium', 120, 'public', true),

    (system_creator, 'Vidhana Soudha Vigil',
     'Near the iconic steps of Vidhana Soudha — Karnataka''s seat of power.',
     'digital', 'Digital collectible postcard of Vidhana Soudha', null, 12.9794, 77.5912, 'medium', 100, 'public', true),

    (system_creator, 'Bull Temple Blessing',
     'Close to the massive monolithic Nandi at Dodda Basavana Gudi, Basavanagudi.',
     'physical', 'Prasadam basket from a nearby local vendor', 150, 12.9423, 77.5678, 'medium', 60, 'public', true),

    (system_creator, 'Summer Palace Whisper',
     'Within sight of Tipu Sultan''s Summer Palace, an old-world treasure awaits.',
     'collectible', 'Miniature replica of the Summer Palace', 300, 12.9591, 77.5744, 'hard', 70, 'public', true),

    (system_creator, 'UB City Glitter',
     'Somewhere around the plush UB City precinct — Bangalore''s answer to Fifth Avenue.',
     'discount_code', '15% off at a UB City cafe', 500, 12.9718, 77.6190, 'hard', 50, 'public', true),

    (system_creator, 'Commercial Street Hustle',
     'Buried in the buzz of Commercial Street''s shopping lanes.',
     'cash', 'Cash reward for the quickest finder', 250, 12.9822, 77.6089, 'medium', 90, 'public', true),

    (system_creator, 'Hebbal Lake Sunrise',
     'By the walking path around Hebbal Lake, best hunted at sunrise.',
     'premium', 'Premium in-app explorer badge frame', null, 13.0450, 77.5950, 'legendary', 60, 'public', true),

    (system_creator, 'ISKCON Sky Temple',
     'Near the base of the ISKCON Temple''s hilltop complex on Hare Krishna Hill.',
     'xp', 'Big XP haul for reaching the temple grounds', null, 12.9930, 77.5511, 'legendary', 80, 'public', true);
end $$;
