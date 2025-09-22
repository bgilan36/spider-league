-- Fix get_current_pt_week_end to always return the next Sunday 00:00 PT (strictly in the future)
-- This prevents errors from validate_challenge_expiry on Sundays after 00:00 PT
CREATE OR REPLACE FUNCTION public.get_current_pt_week_end()
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pt_now_local TIMESTAMP WITH TIME ZONE;        -- current time in PT as timestamptz
  dow INTEGER;                                  -- 0=Sunday .. 6=Saturday
  next_sunday_local TIMESTAMP WITHOUT TIME ZONE;-- next Sunday 00:00 PT (local time)
BEGIN
  -- Get current time in PT
  pt_now_local := now() AT TIME ZONE 'America/Los_Angeles';

  -- Day of week in PT (0=Sunday)
  dow := EXTRACT(DOW FROM pt_now_local);

  -- Compute next Sunday's midnight in PT. If today is Sunday, pick the Sunday one week ahead.
  next_sunday_local := date_trunc('day', pt_now_local)
                       + (CASE WHEN dow = 0 THEN 7 ELSE 7 - dow END) * INTERVAL '1 day';

  -- Return as timestamptz (convert the PT-local timestamp to UTC-aware timestamptz)
  RETURN next_sunday_local AT TIME ZONE 'America/Los_Angeles';
END;
$function$;