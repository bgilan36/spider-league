-- Fix the get_current_pt_week_start function to correctly return the current week's Sunday
-- When today is Sunday, it should return today, not the previous Sunday

CREATE OR REPLACE FUNCTION public.get_current_pt_week_start()
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pt_now TIMESTAMP WITH TIME ZONE;
  pt_date DATE;
  day_of_week INTEGER;
  week_start DATE;
BEGIN
  -- Convert current time to PT
  pt_now := now() AT TIME ZONE 'America/Los_Angeles';
  pt_date := pt_now::DATE;
  
  -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  day_of_week := EXTRACT(DOW FROM pt_date);
  
  -- Subtract the day of week to get back to Sunday
  week_start := pt_date - day_of_week;
  
  RETURN week_start;
END;
$function$;