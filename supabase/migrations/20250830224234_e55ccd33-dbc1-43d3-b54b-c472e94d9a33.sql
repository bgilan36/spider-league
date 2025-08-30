-- Create weekly_uploads table to track uploads per user per week
CREATE TABLE IF NOT EXISTS public.weekly_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  upload_count INTEGER NOT NULL DEFAULT 0,
  first_spider_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Enable RLS
ALTER TABLE public.weekly_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own weekly uploads" 
ON public.weekly_uploads 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly uploads" 
ON public.weekly_uploads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly uploads" 
ON public.weekly_uploads 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for updating timestamps
CREATE TRIGGER update_weekly_uploads_updated_at
BEFORE UPDATE ON public.weekly_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get current PT week start (Sunday 12am PT)
CREATE OR REPLACE FUNCTION public.get_current_pt_week_start()
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  pt_now TIMESTAMP WITH TIME ZONE;
  week_start DATE;
BEGIN
  -- Convert current time to PT
  pt_now := now() AT TIME ZONE 'America/Los_Angeles';
  
  -- Get the start of the week (Sunday) in PT
  week_start := (date_trunc('week', pt_now::DATE) - INTERVAL '1 day')::DATE;
  
  RETURN week_start;
END;
$$;

-- Function to check if user can upload this week
CREATE OR REPLACE FUNCTION public.can_user_upload_this_week(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_week_start DATE;
  upload_count INTEGER;
BEGIN
  current_week_start := public.get_current_pt_week_start();
  
  SELECT COALESCE(upload_count, 0) INTO upload_count
  FROM public.weekly_uploads
  WHERE user_id = user_id_param AND week_start = current_week_start;
  
  RETURN COALESCE(upload_count, 0) = 0;
END;
$$;

-- Function to increment weekly upload count
CREATE OR REPLACE FUNCTION public.increment_weekly_upload(user_id_param UUID, spider_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_week_start DATE;
  existing_count INTEGER;
BEGIN
  current_week_start := public.get_current_pt_week_start();
  
  -- Check if record exists
  SELECT upload_count INTO existing_count
  FROM public.weekly_uploads
  WHERE user_id = user_id_param AND week_start = current_week_start;
  
  IF existing_count IS NULL THEN
    -- First upload this week
    INSERT INTO public.weekly_uploads (user_id, week_start, upload_count, first_spider_id)
    VALUES (user_id_param, current_week_start, 1, spider_id_param);
  ELSE
    -- Subsequent upload
    UPDATE public.weekly_uploads
    SET upload_count = upload_count + 1,
        updated_at = now()
    WHERE user_id = user_id_param AND week_start = current_week_start;
  END IF;
END;
$$;