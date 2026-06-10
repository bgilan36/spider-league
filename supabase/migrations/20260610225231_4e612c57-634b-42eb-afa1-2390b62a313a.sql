
-- =========================================================
-- FIX 1: Private league owner-takeover via permissive UPDATE policy
-- =========================================================
DROP POLICY IF EXISTS "Members can update league image" ON public.private_leagues;

CREATE OR REPLACE FUNCTION public.update_private_league_image(
  p_league_id uuid,
  p_image_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_private_league_member(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this league';
  END IF;

  UPDATE public.private_leagues
  SET image_url = p_image_url,
      updated_at = now()
  WHERE id = p_league_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_private_league_image(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_private_league_image(uuid, text) TO authenticated;

-- =========================================================
-- FIX 2: Spider GPS coordinates exposed to all authenticated users
-- =========================================================
-- Revoke direct read access to location columns from regular clients.
-- The heatmap RPC (SECURITY DEFINER) and owner-only RPC below still work.
REVOKE SELECT (latitude, longitude, location_name, location_accuracy_m)
  ON public.spiders FROM anon, authenticated;

-- Owners can still fetch their own spider's location via this function.
CREATE OR REPLACE FUNCTION public.get_my_spider_location(p_spider_id uuid)
RETURNS TABLE(latitude double precision, longitude double precision, location_name text, location_accuracy_m double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.latitude, s.longitude, s.location_name, s.location_accuracy_m
  FROM public.spiders s
  WHERE s.id = p_spider_id
    AND s.owner_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_spider_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_spider_location(uuid) TO authenticated;
