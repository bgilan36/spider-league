-- Fix transfer_spider_ownership function to add authorization checks
-- This function must only be callable by:
-- 1. Admins (via has_role check)
-- 2. Internal trusted functions (resolve_battle_challenge uses service role context)
-- 3. The current owner of the spider (for potential trading feature)

CREATE OR REPLACE FUNCTION public.transfer_spider_ownership(spider_id uuid, new_owner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_owner_id uuid;
  calling_user_id uuid;
BEGIN
  -- Get the calling user (will be NULL when called from triggers/service role context)
  calling_user_id := auth.uid();
  
  -- Get current owner of the spider
  SELECT owner_id INTO current_owner_id
  FROM public.spiders
  WHERE id = spider_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Spider not found';
  END IF;
  
  -- SECURITY: Authorization check
  -- Allow transfer only if:
  -- 1. Called from service role context (auth.uid() is NULL) - trusted internal calls
  -- 2. Caller is an admin
  -- 3. Caller is the current owner of the spider
  IF calling_user_id IS NOT NULL THEN
    -- There's an authenticated user making this call
    IF NOT (
      public.has_role(calling_user_id, 'admin'::app_role) OR
      calling_user_id = current_owner_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot transfer spider you do not own';
    END IF;
  END IF;
  
  -- Perform the transfer
  UPDATE public.spiders 
  SET owner_id = new_owner_id,
      updated_at = now()
  WHERE id = spider_id;
END;
$function$;