-- Create function to compute the end of the current PT battle week (next Sunday 12:00 AM PT)
CREATE OR REPLACE FUNCTION public.get_current_pt_week_end()
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pt_local TIMESTAMP;
  week_start DATE;
  week_end_local TIMESTAMP;
BEGIN
  -- Get current time in PT as a naive timestamp (local time)
  pt_local := now() AT TIME ZONE 'America/Los_Angeles';

  -- Calculate week start (Sunday 00:00 PT)
  week_start := (date_trunc('week', pt_local::DATE) - INTERVAL '1 day')::DATE;

  -- End of current battle week is next Sunday 00:00 PT
  week_end_local := week_start + INTERVAL '7 days';

  -- Convert local PT time back to timestamptz (UTC aware)
  RETURN week_end_local AT TIME ZONE 'America/Los_Angeles';
END;
$function$;

-- Update default expiry for battle challenges to end of the current PT battle week
ALTER TABLE public.battle_challenges
ALTER COLUMN expires_at SET DEFAULT public.get_current_pt_week_end();