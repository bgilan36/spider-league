-- Fix increment_weekly_upload function to add authorization checks
-- While still allowing the handle_new_user trigger to call it

CREATE OR REPLACE FUNCTION public.increment_weekly_upload(user_id_param uuid, spider_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_week_start DATE;
  existing_count INTEGER;
  calling_user_id UUID;
BEGIN
  -- Get the calling user (will be NULL when called from triggers without session)
  calling_user_id := auth.uid();
  
  -- SECURITY: If there IS an authenticated user, they must match user_id_param
  -- This allows triggers (where auth.uid() is NULL) to call this function
  -- while blocking direct RPC calls from manipulating other users
  IF calling_user_id IS NOT NULL AND calling_user_id != user_id_param THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify another user''s uploads';
  END IF;
  
  -- SECURITY: Verify the spider belongs to the specified user
  IF NOT EXISTS (
    SELECT 1 FROM public.spiders
    WHERE id = spider_id_param AND owner_id = user_id_param
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Spider does not belong to user';
  END IF;
  
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