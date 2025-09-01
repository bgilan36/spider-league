-- Function to get all-time user rankings based on cumulative power scores
CREATE OR REPLACE FUNCTION public.get_user_rankings_all_time()
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  total_power_score integer,
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
    SUM(s.power_score)::integer as total_power_score,
    COUNT(s.id)::integer as spider_count,
    jsonb_build_object(
      'id', max_spider.id,
      'nickname', max_spider.nickname,
      'species', max_spider.species,
      'image_url', max_spider.image_url,
      'power_score', max_spider.power_score,
      'rarity', max_spider.rarity
    ) as top_spider
  FROM public.spiders s
  LEFT JOIN public.profiles p ON s.owner_id = p.id
  LEFT JOIN LATERAL (
    SELECT id, nickname, species, image_url, power_score, rarity
    FROM public.spiders s2
    WHERE s2.owner_id = s.owner_id 
      AND s2.is_approved = true
    ORDER BY s2.power_score DESC
    LIMIT 1
  ) max_spider ON true
  WHERE s.is_approved = true
  GROUP BY s.owner_id, p.display_name, p.avatar_url, max_spider.id, max_spider.nickname, max_spider.species, max_spider.image_url, max_spider.power_score, max_spider.rarity
  ORDER BY total_power_score DESC;
END;
$$;

-- Function to get weekly user rankings based on cumulative power scores for a specific week
-- Including spiders acquired through battles that week
CREATE OR REPLACE FUNCTION public.get_user_rankings_weekly(week_id_param uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  week_power_score integer,
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
  -- Get week dates
  SELECT w.start_date, w.end_date
  INTO week_start_date, week_end_date
  FROM public.weeks w
  WHERE w.id = week_id_param;
  
  RETURN QUERY
  SELECT 
    s.owner_id,
    p.display_name,
    p.avatar_url,
    SUM(s.power_score)::integer as week_power_score,
    COUNT(s.id)::integer as week_spider_count,
    COUNT(CASE WHEN bc.battle_id IS NOT NULL THEN 1 END)::integer as spiders_acquired_in_battle,
    jsonb_build_object(
      'id', max_spider.id,
      'nickname', max_spider.nickname,
      'species', max_spider.species,
      'image_url', max_spider.image_url,
      'power_score', max_spider.power_score,
      'rarity', max_spider.rarity
    ) as top_spider
  FROM public.spiders s
  LEFT JOIN public.profiles p ON s.owner_id = p.id
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
      (s.created_at >= week_start_date AND s.created_at <= week_end_date) -- Spiders created this week
      OR 
      (bc.battle_id IS NOT NULL) -- Spiders acquired through battles this week
    )
  GROUP BY s.owner_id, p.display_name, p.avatar_url, max_spider.id, max_spider.nickname, max_spider.species, max_spider.image_url, max_spider.power_score, max_spider.rarity
  ORDER BY week_power_score DESC;
END;
$$;