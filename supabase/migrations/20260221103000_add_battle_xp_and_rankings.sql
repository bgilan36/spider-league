-- Add server-authoritative XP rewards for completed MATCHUP battles.
CREATE TABLE IF NOT EXISTS public.battle_xp_awards (
  battle_id uuid PRIMARY KEY REFERENCES public.battles(id) ON DELETE CASCADE,
  winner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_awarded integer NOT NULL CHECK (xp_awarded > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battle_xp_awards_winner_user
  ON public.battle_xp_awards (winner_user_id, created_at DESC);

ALTER TABLE public.battle_xp_awards ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.award_battle_xp_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_xp_gain integer := 15;
  v_winner_user_text text;
  v_winner_user_id uuid;
  v_inserted_battle_id uuid;
BEGIN
  IF NEW.winner IS NULL OR NEW.winner = 'TIE' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_active, true) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.type::text, 'MATCHUP') <> 'MATCHUP' THEN
    RETURN NEW;
  END IF;

  IF NEW.winner = 'A' THEN
    v_winner_user_text := COALESCE(NEW.team_a->>'userId', NEW.team_a->0->>'userId');
  ELSIF NEW.winner = 'B' THEN
    v_winner_user_text := COALESCE(NEW.team_b->>'userId', NEW.team_b->0->>'userId');
  END IF;

  IF v_winner_user_text IS NULL OR v_winner_user_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN NEW;
  END IF;

  v_winner_user_id := v_winner_user_text::uuid;

  PERFORM public.ensure_user_progression(v_winner_user_id);

  INSERT INTO public.battle_xp_awards (battle_id, winner_user_id, xp_awarded)
  VALUES (NEW.id, v_winner_user_id, v_xp_gain)
  ON CONFLICT (battle_id) DO NOTHING
  RETURNING battle_id INTO v_inserted_battle_id;

  IF v_inserted_battle_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.user_progression
  SET experience_points = experience_points + v_xp_gain,
      level = ((experience_points + v_xp_gain) / 100) + 1,
      updated_at = now()
  WHERE user_id = v_winner_user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_battle_xp_on_completion ON public.battles;

CREATE TRIGGER trg_award_battle_xp_on_completion
AFTER INSERT OR UPDATE OF winner, is_active
ON public.battles
FOR EACH ROW
EXECUTE FUNCTION public.award_battle_xp_on_completion();

-- Include XP in leaderboard ranking score.
DROP FUNCTION IF EXISTS public.get_user_rankings_all_time();

CREATE FUNCTION public.get_user_rankings_all_time()
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  total_power_score integer,
  experience_points integer,
  ranking_score integer,
  spider_count integer,
  top_spider jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.owner_id,
    p.display_name,
    p.avatar_url,
    SUM(s.power_score)::integer AS total_power_score,
    COALESCE(up.experience_points, 0)::integer AS experience_points,
    (SUM(s.power_score)::integer + COALESCE(up.experience_points, 0)::integer) AS ranking_score,
    COUNT(s.id)::integer AS spider_count,
    jsonb_build_object(
      'id', max_spider.id,
      'nickname', max_spider.nickname,
      'species', max_spider.species,
      'image_url', max_spider.image_url,
      'power_score', max_spider.power_score,
      'rarity', max_spider.rarity
    ) AS top_spider
  FROM public.spiders s
  LEFT JOIN public.profiles p ON s.owner_id = p.id
  LEFT JOIN public.user_progression up ON up.user_id = s.owner_id
  LEFT JOIN LATERAL (
    SELECT id, nickname, species, image_url, power_score, rarity
    FROM public.spiders s2
    WHERE s2.owner_id = s.owner_id
      AND s2.is_approved = true
    ORDER BY s2.power_score DESC
    LIMIT 1
  ) max_spider ON true
  WHERE s.is_approved = true
  GROUP BY s.owner_id, p.display_name, p.avatar_url, up.experience_points,
           max_spider.id, max_spider.nickname, max_spider.species, max_spider.image_url, max_spider.power_score, max_spider.rarity
  ORDER BY ranking_score DESC, total_power_score DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_user_rankings_weekly(uuid);

CREATE FUNCTION public.get_user_rankings_weekly(week_id_param uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  week_power_score integer,
  experience_points integer,
  ranking_score integer,
  week_spider_count integer,
  spiders_acquired_in_battle integer,
  top_spider jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  week_start_date timestamp;
  week_end_date timestamp;
BEGIN
  SELECT w.start_date, w.end_date
  INTO week_start_date, week_end_date
  FROM public.weeks w
  WHERE w.id = week_id_param;

  RETURN QUERY
  SELECT
    s.owner_id,
    p.display_name,
    p.avatar_url,
    SUM(s.power_score)::integer AS week_power_score,
    COALESCE(up.experience_points, 0)::integer AS experience_points,
    (SUM(s.power_score)::integer + COALESCE(up.experience_points, 0)::integer) AS ranking_score,
    COUNT(s.id)::integer AS week_spider_count,
    COUNT(CASE WHEN bc.battle_id IS NOT NULL THEN 1 END)::integer AS spiders_acquired_in_battle,
    jsonb_build_object(
      'id', max_spider.id,
      'nickname', max_spider.nickname,
      'species', max_spider.species,
      'image_url', max_spider.image_url,
      'power_score', max_spider.power_score,
      'rarity', max_spider.rarity
    ) AS top_spider
  FROM public.spiders s
  LEFT JOIN public.profiles p ON s.owner_id = p.id
  LEFT JOIN public.user_progression up ON up.user_id = s.owner_id
  LEFT JOIN public.battle_challenges bc ON (
    s.id = bc.loser_spider_id
    AND bc.winner_id = s.owner_id
    AND bc.status = 'COMPLETED'
    AND bc.created_at >= week_start_date
    AND bc.created_at <= week_end_date
  )
  LEFT JOIN LATERAL (
    SELECT id, nickname, species, image_url, power_score, rarity
    FROM public.spiders s2
    WHERE s2.owner_id = s.owner_id
      AND s2.is_approved = true
    ORDER BY s2.power_score DESC
    LIMIT 1
  ) max_spider ON true
  WHERE s.is_approved = true
    AND (
      (s.created_at >= week_start_date AND s.created_at <= week_end_date)
      OR
      (bc.battle_id IS NOT NULL)
    )
  GROUP BY s.owner_id, p.display_name, p.avatar_url, up.experience_points,
           max_spider.id, max_spider.nickname, max_spider.species, max_spider.image_url, max_spider.power_score, max_spider.rarity
  ORDER BY ranking_score DESC, week_power_score DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rankings_all_time() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_rankings_all_time() TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_rankings_weekly(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_rankings_weekly(uuid) TO anon;
