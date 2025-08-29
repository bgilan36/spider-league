-- Tighten RLS and secure functions for weekly rankings
DROP POLICY IF EXISTS "System can manage weekly rankings" ON public.weekly_rankings;

CREATE OR REPLACE FUNCTION public.get_current_week()
RETURNS UUID
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