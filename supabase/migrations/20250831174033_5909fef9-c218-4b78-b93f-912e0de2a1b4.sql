-- Fix ambiguous column reference by qualifying column names and avoiding name collisions
-- Update can_user_upload_this_week and increment_weekly_upload

-- can_user_upload_this_week: ensure no ambiguity between variable and column names
CREATE OR REPLACE FUNCTION public.can_user_upload_this_week(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_week_start DATE;
  upload_count_value INTEGER;
BEGIN
  current_week_start := public.get_current_pt_week_start();
  
  SELECT COALESCE(wu.upload_count, 0)
    INTO upload_count_value
  FROM public.weekly_uploads AS wu
  WHERE wu.user_id = user_id_param
    AND wu.week_start = current_week_start;
  
  RETURN COALESCE(upload_count_value, 0) = 0;
END;
$function$;

-- increment_weekly_upload: qualify columns to be explicit
CREATE OR REPLACE FUNCTION public.increment_weekly_upload(user_id_param uuid, spider_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_week_start DATE;
  existing_count INTEGER;
BEGIN
  current_week_start := public.get_current_pt_week_start();
  
  -- Check if record exists
  SELECT wu.upload_count
    INTO existing_count
  FROM public.weekly_uploads AS wu
  WHERE wu.user_id = user_id_param 
    AND wu.week_start = current_week_start;
  
  IF existing_count IS NULL THEN
    -- First upload this week
    INSERT INTO public.weekly_uploads (user_id, week_start, upload_count, first_spider_id)
    VALUES (user_id_param, current_week_start, 1, spider_id_param);
  ELSE
    -- Subsequent upload
    UPDATE public.weekly_uploads AS wu
    SET upload_count = wu.upload_count + 1,
        updated_at = now()
    WHERE wu.user_id = user_id_param 
      AND wu.week_start = current_week_start;
  END IF;
END;
$function$;