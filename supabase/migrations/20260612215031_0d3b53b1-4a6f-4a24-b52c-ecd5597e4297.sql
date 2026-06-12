
ALTER TABLE public.spiders
  ADD COLUMN IF NOT EXISTS city_key TEXT
  GENERATED ALWAYS AS (NULLIF(lower(btrim(location_name)), '')) STORED;

CREATE INDEX IF NOT EXISTS spiders_city_key_idx
  ON public.spiders (city_key) WHERE city_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.local_legend_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  city_key TEXT NOT NULL,
  spider_id UUID NOT NULL REFERENCES public.spiders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  power_score INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_start, city_key)
);
GRANT SELECT ON public.local_legend_winners TO anon, authenticated;
GRANT ALL  ON public.local_legend_winners TO service_role;
ALTER TABLE public.local_legend_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "local_legend_winners readable" ON public.local_legend_winners;
CREATE POLICY "local_legend_winners readable" ON public.local_legend_winners FOR SELECT USING (true);

INSERT INTO public.badges (name, description, icon, criteria, rarity)
SELECT 'Local Legend',
       'Topped your city''s weekly spider leaderboard.',
       '🏙️',
       jsonb_build_object('type','local_legend'),
       'epic'
WHERE NOT EXISTS (SELECT 1 FROM public.badges WHERE name = 'Local Legend');

CREATE OR REPLACE FUNCTION public.get_city_leaderboard(p_city_key TEXT, p_limit INT DEFAULT 25)
RETURNS TABLE (
  spider_id UUID, owner_id UUID, nickname TEXT, species TEXT, image_url TEXT,
  rarity public.spider_rarity, power_score INT, owner_display_name TEXT, rank_position INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH wk AS (
    SELECT (date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles'))
            AT TIME ZONE 'America/Los_Angeles') AS wk_start
  )
  SELECT s.id, s.owner_id, s.nickname, s.species, s.image_url, s.rarity, s.power_score,
         p.display_name,
         ROW_NUMBER() OVER (ORDER BY s.power_score DESC, s.created_at ASC)::INT
  FROM public.spiders s
  LEFT JOIN public.profiles p ON p.id = s.owner_id
  CROSS JOIN wk
  WHERE s.city_key = lower(btrim(p_city_key))
    AND s.is_approved = true
    AND s.created_at >= wk.wk_start
  ORDER BY s.power_score DESC, s.created_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit,25), 100));
$$;
GRANT EXECUTE ON FUNCTION public.get_city_leaderboard(TEXT, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_cities_with_spiders()
RETURNS TABLE (city_key TEXT, display_name TEXT, spider_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.city_key, MIN(s.location_name), COUNT(*)::BIGINT
  FROM public.spiders s
  WHERE s.city_key IS NOT NULL AND s.is_approved = true
  GROUP BY s.city_key
  HAVING COUNT(*) >= 3
  ORDER BY COUNT(*) DESC
  LIMIT 200;
$$;
GRANT EXECUTE ON FUNCTION public.list_cities_with_spiders() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_top_spider_in_area(
  p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_radius_deg DOUBLE PRECISION DEFAULT 0.5
)
RETURNS TABLE (
  spider_id UUID, owner_id UUID, nickname TEXT, species TEXT, image_url TEXT,
  rarity public.spider_rarity, power_score INT, location_name TEXT, city_key TEXT,
  owner_display_name TEXT, area_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH in_area AS (
    SELECT s.* FROM public.spiders s
    JOIN public.profile_settings ps ON ps.id = s.owner_id
    WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
      AND ps.share_spider_locations = true
      AND s.is_approved = true
      AND s.latitude BETWEEN p_lat - p_radius_deg AND p_lat + p_radius_deg
      AND s.longitude BETWEEN p_lng - p_radius_deg AND p_lng + p_radius_deg
  )
  SELECT s.id, s.owner_id, s.nickname, s.species, s.image_url, s.rarity, s.power_score,
         s.location_name, s.city_key,
         p.display_name, (SELECT COUNT(*) FROM in_area)::BIGINT
  FROM in_area s
  LEFT JOIN public.profiles p ON p.id = s.owner_id
  ORDER BY s.power_score DESC, s.created_at ASC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_top_spider_in_area(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_heatmap_stats()
RETURNS TABLE (mapped_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.spiders s
  JOIN public.profile_settings ps ON ps.id = s.owner_id
  WHERE s.is_approved = true
    AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
    AND ps.share_spider_locations = true;
$$;
GRANT EXECUTE ON FUNCTION public.get_heatmap_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_local_legends_for_current_week()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wk_start DATE;
  v_badge_id UUID;
  v_inserted INT := 0;
  r RECORD;
BEGIN
  v_wk_start := (date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles')))::DATE;
  SELECT id INTO v_badge_id FROM public.badges WHERE name = 'Local Legend' LIMIT 1;
  IF v_badge_id IS NULL THEN RETURN 0; END IF;

  FOR r IN
    SELECT DISTINCT ON (s.city_key) s.city_key, s.id AS spider_id, s.owner_id, s.power_score
    FROM public.spiders s
    WHERE s.city_key IS NOT NULL AND s.is_approved = true
      AND s.created_at >= (v_wk_start::timestamptz AT TIME ZONE 'America/Los_Angeles')
    ORDER BY s.city_key, s.power_score DESC, s.created_at ASC
  LOOP
    INSERT INTO public.local_legend_winners(week_start, city_key, spider_id, user_id, power_score)
    VALUES (v_wk_start, r.city_key, r.spider_id, r.owner_id, r.power_score)
    ON CONFLICT (week_start, city_key) DO NOTHING;

    INSERT INTO public.user_badges (user_id, badge_id) VALUES (r.owner_id, v_badge_id)
    ON CONFLICT DO NOTHING;
    v_inserted := v_inserted + 1;
  END LOOP;
  RETURN v_inserted;
END; $$;
GRANT EXECUTE ON FUNCTION public.award_local_legends_for_current_week() TO authenticated, service_role;
