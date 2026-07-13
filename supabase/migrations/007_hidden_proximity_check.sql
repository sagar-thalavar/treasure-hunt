-- ============================================================
-- Server-side proximity check
--
-- Why this exists: the app never renders a treasure's exact latitude/
-- longitude in the UI, but that alone doesn't actually hide it — any
-- query that SELECTs those columns still returns them in the raw network
-- response, which anyone can read from browser devtools regardless of
-- what the UI displays. To genuinely keep the location hidden (not just
-- unrendered), the distance-to-treasure calculation has to happen here,
-- in the database, and only a distance figure + true/false comes back to
-- the client — never the coordinates themselves.
--
-- The client (claim flow) should call this via supabase.rpc(...) with the
-- user's live GPS position, and should never SELECT latitude/longitude
-- directly from the treasures table except in admin/creator-only views.
-- ============================================================

create or replace function check_treasure_proximity(
  p_treasure_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns table (distance_meters double precision, within_radius boolean, radius_meters integer)
language plpgsql
security definer
as $$
declare
  t_lat double precision;
  t_lng double precision;
  t_radius integer;
  computed_distance double precision;
begin
  select treasures.latitude, treasures.longitude, treasures.radius_meters into t_lat, t_lng, t_radius
  from treasures
  where id = p_treasure_id and status = 'approved' and is_active = true;

  if t_lat is null then
    raise exception 'Treasure not found or not active';
  end if;

  -- Haversine formula (meters). clamp the acos() argument to [-1, 1] to
  -- avoid floating-point rounding pushing it just outside the domain.
  computed_distance := 6371000 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(p_lat)) * cos(radians(t_lat)) * cos(radians(t_lng) - radians(p_lng))
      + sin(radians(p_lat)) * sin(radians(t_lat))
    ))
  );

  return query select computed_distance, computed_distance <= t_radius, t_radius;
end;
$$;

grant execute on function check_treasure_proximity(uuid, double precision, double precision) to authenticated;
