
-- 1. species_collected table
CREATE TABLE public.species_collected (
  user_id uuid NOT NULL,
  species_slug text NOT NULL,
  common_name text NOT NULL,
  first_caught_at timestamptz NOT NULL DEFAULT now(),
  first_spider_id uuid NOT NULL,
  best_spider_id uuid NOT NULL,
  best_power integer NOT NULL DEFAULT 0,
  count integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, species_slug)
);

GRANT SELECT ON public.species_collected TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.species_collected TO authenticated;
GRANT ALL ON public.species_collected TO service_role;

ALTER TABLE public.species_collected ENABLE ROW LEVEL SECURITY;

-- Owners can read their own dex; public dex pages (e.g. profile) can also view.
CREATE POLICY "Anyone can view species collections"
  ON public.species_collected FOR SELECT
  USING (true);

CREATE POLICY "Users manage their own species rows"
  ON public.species_collected FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX species_collected_user_idx ON public.species_collected(user_id);

-- 2. Seed the three new collector badges
INSERT INTO public.badges (name, description, icon, rarity, color, criteria)
VALUES
  ('Naturalist',        'Catch 5 distinct spider species',  '🌿', 'rare',      '#22c55e', '{"type":"distinct_species","target":5}'::jsonb),
  ('Field Researcher',  'Catch 10 distinct spider species', '🔬', 'epic',      '#a855f7', '{"type":"distinct_species","target":10}'::jsonb),
  ('Spider Curator',    'Catch 25 distinct spider species', '📖', 'legendary', '#facc15', '{"type":"distinct_species","target":25}'::jsonb)
ON CONFLICT DO NOTHING;

-- 3. RPC: claim_species_for_spider
CREATE OR REPLACE FUNCTION public.claim_species_for_spider(
  p_spider_id uuid,
  p_species_slug text,
  p_common_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spider   public.spiders%ROWTYPE;
  v_caller   uuid := auth.uid();
  v_existing public.species_collected%ROWTYPE;
  v_inserted boolean := false;
  v_distinct integer;
  v_badge_name text := null;
  v_badge_id uuid;
BEGIN
  SELECT * INTO v_spider FROM public.spiders WHERE id = p_spider_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'spider_not_found');
  END IF;

  -- Caller must own the spider (service role bypasses this via SECURITY DEFINER + null auth.uid()).
  IF v_caller IS NOT NULL AND v_caller <> v_spider.owner_id THEN
    RETURN jsonb_build_object('error', 'not_owner');
  END IF;

  IF p_species_slug IS NULL OR length(trim(p_species_slug)) = 0 THEN
    RETURN jsonb_build_object('new_species', false, 'reason', 'no_slug');
  END IF;

  SELECT * INTO v_existing
    FROM public.species_collected
   WHERE user_id = v_spider.owner_id AND species_slug = p_species_slug
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.species_collected
      (user_id, species_slug, common_name, first_spider_id, best_spider_id, best_power, count)
    VALUES
      (v_spider.owner_id, p_species_slug, p_common_name, v_spider.id, v_spider.id, v_spider.power_score, 1);
    v_inserted := true;
  ELSE
    UPDATE public.species_collected
       SET count = v_existing.count + 1,
           best_power     = GREATEST(v_existing.best_power, v_spider.power_score),
           best_spider_id = CASE
             WHEN v_spider.power_score > v_existing.best_power THEN v_spider.id
             ELSE v_existing.best_spider_id
           END,
           updated_at = now()
     WHERE user_id = v_spider.owner_id AND species_slug = p_species_slug;
  END IF;

  IF NOT v_inserted THEN
    RETURN jsonb_build_object(
      'new_species', false,
      'count', v_existing.count + 1,
      'best_power', GREATEST(v_existing.best_power, v_spider.power_score)
    );
  END IF;

  -- Newly inserted: award XP and check badges.
  UPDATE public.profiles SET xp = COALESCE(xp, 0) + 50 WHERE id = v_spider.owner_id;

  SELECT count(*) INTO v_distinct
    FROM public.species_collected
   WHERE user_id = v_spider.owner_id;

  IF v_distinct IN (5, 10, 25) THEN
    SELECT id, name INTO v_badge_id, v_badge_name
      FROM public.badges
     WHERE criteria->>'type' = 'distinct_species'
       AND (criteria->>'target')::int = v_distinct
     LIMIT 1;

    IF v_badge_id IS NOT NULL THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (v_spider.owner_id, v_badge_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'new_species', true,
    'xp_awarded', 50,
    'badge_unlocked', v_badge_name,
    'distinct_species', v_distinct,
    'species_slug', p_species_slug,
    'common_name', p_common_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_species_for_spider(uuid, text, text) TO authenticated, service_role;

-- 4. Backfill: populate species_collected from all existing approved spiders.
-- We can't infer canonical slugs server-side (the matcher lives in TS); use
-- raw species text as a placeholder slug so existing users see their history.
-- The next upload will write canonical slugs going forward.
INSERT INTO public.species_collected
  (user_id, species_slug, common_name, first_spider_id, best_spider_id, best_power, count, first_caught_at)
SELECT
  s.owner_id,
  lower(regexp_replace(trim(s.species), '\s+', '_', 'g')) AS species_slug,
  trim(s.species)                                          AS common_name,
  (array_agg(s.id ORDER BY s.created_at ASC))[1]           AS first_spider_id,
  (array_agg(s.id ORDER BY s.power_score DESC, s.created_at ASC))[1] AS best_spider_id,
  max(s.power_score)                                       AS best_power,
  count(*)::int                                            AS count,
  min(s.created_at)                                        AS first_caught_at
  FROM public.spiders s
 WHERE s.is_approved = true
   AND s.species IS NOT NULL
   AND length(trim(s.species)) > 0
 GROUP BY s.owner_id, lower(regexp_replace(trim(s.species), '\s+', '_', 'g')), trim(s.species)
ON CONFLICT (user_id, species_slug) DO NOTHING;
