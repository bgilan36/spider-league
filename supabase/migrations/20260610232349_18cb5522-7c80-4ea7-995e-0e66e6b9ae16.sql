
ALTER TABLE public.spiders
  ADD COLUMN IF NOT EXISTS level_power_bonus integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.calculate_spider_level(spider_xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN spider_xp >= 700 THEN 6
    WHEN spider_xp >= 450 THEN 5
    WHEN spider_xp >= 250 THEN 4
    WHEN spider_xp >= 120 THEN 3
    WHEN spider_xp >= 50  THEN 2
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.xp_for_next_level(current_level integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE current_level
    WHEN 1 THEN 50 WHEN 2 THEN 120 WHEN 3 THEN 250
    WHEN 4 THEN 450 WHEN 5 THEN 700 ELSE 700
  END;
$$;

CREATE OR REPLACE FUNCTION public.award_spider_xp(p_spider_id uuid, p_xp_amount integer, p_seed text DEFAULT ''::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_old_xp integer; v_old_level integer; v_new_xp integer; v_new_level integer;
  v_levels_gained integer; v_power_bonus integer;
BEGIN
  SELECT xp, level INTO v_old_xp, v_old_level FROM public.spiders WHERE id = p_spider_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Spider not found'); END IF;
  v_new_xp := GREATEST(0, v_old_xp + COALESCE(p_xp_amount, 0));
  v_new_level := public.calculate_spider_level(v_new_xp);
  v_levels_gained := GREATEST(0, v_new_level - v_old_level);
  v_power_bonus := v_levels_gained * 5;
  UPDATE public.spiders
  SET xp = v_new_xp, level = v_new_level,
      power_score = power_score + v_power_bonus,
      level_power_bonus = level_power_bonus + v_power_bonus,
      updated_at = now()
  WHERE id = p_spider_id;
  RETURN jsonb_build_object(
    'spider_id', p_spider_id, 'xp_gained', p_xp_amount,
    'old_xp', v_old_xp, 'new_xp', v_new_xp,
    'old_level', v_old_level, 'new_level', v_new_level,
    'leveled_up', v_levels_gained > 0,
    'levels_gained', v_levels_gained,
    'power_bonus_gained', v_power_bonus
  );
END; $$;

DROP FUNCTION IF EXISTS public.get_user_rankings_all_time();
CREATE OR REPLACE FUNCTION public.get_user_rankings_all_time()
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, total_power_score integer, spider_count integer, experience_points integer, ranking_score integer, top_spider jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.owner_id,
    p.display_name,
    p.avatar_url,
    SUM(s.power_score)::integer,
    COUNT(s.id)::integer,
    COALESCE(SUM(s.xp), 0)::integer,
    (SUM(s.power_score) + COALESCE(SUM(s.xp),0))::integer,
    jsonb_build_object(
      'id', max_spider.id, 'nickname', max_spider.nickname,
      'species', max_spider.species, 'image_url', max_spider.image_url,
      'power_score', max_spider.power_score, 'rarity', max_spider.rarity
    )
  FROM public.spiders s
  LEFT JOIN public.profiles p ON s.owner_id = p.id
  LEFT JOIN LATERAL (
    SELECT id, nickname, species, image_url, power_score, rarity
    FROM public.spiders s2
    WHERE s2.owner_id = s.owner_id AND s2.is_approved = true
    ORDER BY s2.power_score DESC LIMIT 1
  ) max_spider ON true
  WHERE s.is_approved = true
  GROUP BY s.owner_id, p.display_name, p.avatar_url,
           max_spider.id, max_spider.nickname, max_spider.species,
           max_spider.image_url, max_spider.power_score, max_spider.rarity
  ORDER BY (SUM(s.power_score) + COALESCE(SUM(s.xp),0)) DESC;
END; $$;

DROP FUNCTION IF EXISTS public.get_user_rankings_weekly(uuid);
CREATE OR REPLACE FUNCTION public.get_user_rankings_weekly(week_id_param uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, week_power_score integer, week_spider_count integer, spiders_acquired_in_battle integer, experience_points integer, ranking_score integer, top_spider jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  week_start_date timestamp; week_end_date timestamp;
BEGIN
  SELECT w.start_date, w.end_date INTO week_start_date, week_end_date
  FROM public.weeks w WHERE w.id = week_id_param;
  RETURN QUERY
  SELECT
    s.owner_id,
    p.display_name,
    p.avatar_url,
    SUM(s.power_score)::integer,
    COUNT(s.id)::integer,
    COUNT(CASE WHEN bc.battle_id IS NOT NULL THEN 1 END)::integer,
    COALESCE(SUM(s.xp),0)::integer,
    (SUM(s.power_score) + COALESCE(SUM(s.xp),0))::integer,
    jsonb_build_object(
      'id', max_spider.id, 'nickname', max_spider.nickname,
      'species', max_spider.species, 'image_url', max_spider.image_url,
      'power_score', max_spider.power_score, 'rarity', max_spider.rarity
    )
  FROM public.spiders s
  LEFT JOIN public.profiles p ON s.owner_id = p.id
  LEFT JOIN public.battle_challenges bc ON (
    s.id = bc.loser_spider_id AND bc.winner_id = s.owner_id
    AND bc.status = 'COMPLETED'
    AND bc.created_at >= week_start_date AND bc.created_at <= week_end_date
  )
  LEFT JOIN LATERAL (
    SELECT id, nickname, species, image_url, power_score, rarity
    FROM public.spiders s2
    WHERE s2.owner_id = s.owner_id AND s2.is_approved = true
    ORDER BY s2.power_score DESC LIMIT 1
  ) max_spider ON true
  WHERE s.is_approved = true
    AND (
      (s.created_at >= week_start_date AND s.created_at <= week_end_date)
      OR (bc.battle_id IS NOT NULL)
    )
  GROUP BY s.owner_id, p.display_name, p.avatar_url,
           max_spider.id, max_spider.nickname, max_spider.species,
           max_spider.image_url, max_spider.power_score, max_spider.rarity
  ORDER BY (SUM(s.power_score) + COALESCE(SUM(s.xp),0)) DESC;
END; $$;
