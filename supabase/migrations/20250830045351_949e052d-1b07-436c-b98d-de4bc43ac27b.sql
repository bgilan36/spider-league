-- Fix security warnings from the linter

-- 1. Fix Function Search Path Mutable - Update functions to have secure search_path
CREATE OR REPLACE FUNCTION public.validate_challenge_expiry()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure expires_at is in the future and not more than 7 days
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Challenge expiry must be in the future';
  END IF;
  
  IF NEW.expires_at > (now() + INTERVAL '7 days') THEN
    RAISE EXCEPTION 'Challenge cannot expire more than 7 days in the future';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update other functions to have secure search_path
CREATE OR REPLACE FUNCTION public.transfer_spider_ownership(spider_id uuid, new_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.spiders 
  SET owner_id = new_owner_id,
      updated_at = now()
  WHERE id = spider_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_week()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_week_id UUID;
  week_start DATE;
  week_end DATE;
  current_season_id UUID;
BEGIN
  -- Calculate the start of current week (Sunday)
  week_start := date_trunc('week', CURRENT_DATE)::DATE;
  week_end := week_start + INTERVAL '6 days';
  
  -- Get current season (you may need to adjust this logic)
  SELECT id INTO current_season_id 
  FROM public.seasons 
  WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
  LIMIT 1;
  
  -- If no current season, create a default one
  IF current_season_id IS NULL THEN
    INSERT INTO public.seasons (name, start_date, end_date, current_week_number)
    VALUES ('Season 1', '2024-01-01'::DATE, '2024-12-31'::DATE, 1)
    RETURNING id INTO current_season_id;
  END IF;
  
  -- Check if current week exists
  SELECT id INTO current_week_id
  FROM public.weeks
  WHERE start_date::DATE = week_start;
  
  -- If not, create it
  IF current_week_id IS NULL THEN
    -- Get next week number
    INSERT INTO public.weeks (season_id, week_number, start_date, end_date)
    VALUES (
      current_season_id,
      COALESCE((SELECT MAX(week_number) + 1 FROM public.weeks WHERE season_id = current_season_id), 1),
      week_start,
      week_end
    )
    RETURNING id INTO current_week_id;
  END IF;
  
  RETURN current_week_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_weekly_rankings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_week_id UUID;
BEGIN
  -- Get current week
  current_week_id := public.get_current_week();
  
  -- Clear existing rankings for current week
  DELETE FROM public.weekly_rankings WHERE week_id = current_week_id;
  
  -- Insert current rankings
  INSERT INTO public.weekly_rankings (spider_id, week_id, power_score, rank_position)
  SELECT 
    s.id,
    current_week_id,
    s.power_score,
    ROW_NUMBER() OVER (ORDER BY s.power_score DESC)
  FROM public.spiders s
  WHERE s.is_approved = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_battle_challenge(challenge_id uuid, winner_user_id uuid, loser_user_id uuid, battle_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_record RECORD;
  loser_spider UUID;
BEGIN
  -- Get challenge details
  SELECT * INTO challenge_record
  FROM public.battle_challenges
  WHERE id = challenge_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;
  
  -- Determine which spider gets transferred
  IF winner_user_id = challenge_record.challenger_id THEN
    loser_spider := challenge_record.accepter_spider_id;
  ELSE
    loser_spider := challenge_record.challenger_spider_id;
  END IF;
  
  -- Transfer spider ownership
  PERFORM public.transfer_spider_ownership(loser_spider, winner_user_id);
  
  -- Update challenge status
  UPDATE public.battle_challenges
  SET status = 'COMPLETED',
      battle_id = battle_id_param,
      winner_id = winner_user_id,
      loser_spider_id = loser_spider
  WHERE id = challenge_id;
END;
$$;