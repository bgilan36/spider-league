-- Add columns to track all 3 eligible spiders per week
ALTER TABLE public.weekly_uploads
ADD COLUMN IF NOT EXISTS second_spider_id UUID REFERENCES public.spiders(id),
ADD COLUMN IF NOT EXISTS third_spider_id UUID REFERENCES public.spiders(id);

-- Update the can_user_upload_this_week function to allow up to 3 uploads
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
  
  -- Allow up to 3 uploads per week
  RETURN COALESCE(upload_count_value, 0) < 3;
END;
$function$;

-- Update increment_weekly_upload to track all 3 spider IDs
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
  ELSIF existing_count = 1 THEN
    -- Second upload this week
    UPDATE public.weekly_uploads AS wu
    SET upload_count = 2,
        second_spider_id = spider_id_param,
        updated_at = now()
    WHERE wu.user_id = user_id_param 
      AND wu.week_start = current_week_start;
  ELSIF existing_count = 2 THEN
    -- Third upload this week
    UPDATE public.weekly_uploads AS wu
    SET upload_count = 3,
        third_spider_id = spider_id_param,
        updated_at = now()
    WHERE wu.user_id = user_id_param 
      AND wu.week_start = current_week_start;
  ELSE
    -- Already at limit, raise error
    RAISE EXCEPTION 'Weekly upload limit of 3 spiders reached';
  END IF;
END;
$function$;