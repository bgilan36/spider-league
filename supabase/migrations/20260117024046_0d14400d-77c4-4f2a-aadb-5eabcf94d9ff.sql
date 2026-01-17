-- Create login_streaks table for tracking daily login streaks
CREATE TABLE public.login_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 1,
  longest_streak INTEGER NOT NULL DEFAULT 1,
  last_login_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_power_bonus INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.login_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own streak"
  ON public.login_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak"
  ON public.login_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak"
  ON public.login_streaks FOR UPDATE
  USING (auth.uid() = user_id);

-- Create spider_of_the_day table
CREATE TABLE public.spider_of_the_day (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spider_id UUID NOT NULL REFERENCES public.spiders(id) ON DELETE CASCADE,
  featured_date DATE NOT NULL DEFAULT CURRENT_DATE,
  power_bonus INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(featured_date)
);

-- Enable RLS
ALTER TABLE public.spider_of_the_day ENABLE ROW LEVEL SECURITY;

-- RLS Policies - everyone can view spider of the day
CREATE POLICY "Spider of the day is viewable by everyone"
  ON public.spider_of_the_day FOR SELECT
  USING (true);

-- Only admins can manage spider of the day
CREATE POLICY "Admins can manage spider of the day"
  ON public.spider_of_the_day FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to select spider of the day (runs daily via cron)
CREATE OR REPLACE FUNCTION public.select_spider_of_the_day()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_spider_id UUID;
  today_date DATE := CURRENT_DATE;
BEGIN
  -- Check if we already have a spider for today
  IF EXISTS (SELECT 1 FROM spider_of_the_day WHERE featured_date = today_date) THEN
    RETURN;
  END IF;
  
  -- Select a random approved spider that hasn't been featured in the last 30 days
  SELECT id INTO selected_spider_id
  FROM spiders
  WHERE is_approved = true
    AND id NOT IN (
      SELECT spider_id FROM spider_of_the_day 
      WHERE featured_date > today_date - INTERVAL '30 days'
    )
  ORDER BY random()
  LIMIT 1;
  
  -- If no eligible spider, pick any approved spider
  IF selected_spider_id IS NULL THEN
    SELECT id INTO selected_spider_id
    FROM spiders
    WHERE is_approved = true
    ORDER BY random()
    LIMIT 1;
  END IF;
  
  -- Insert if we found a spider
  IF selected_spider_id IS NOT NULL THEN
    INSERT INTO spider_of_the_day (spider_id, featured_date, power_bonus)
    VALUES (selected_spider_id, today_date, 10);
  END IF;
END;
$$;

-- Update timestamp trigger for login_streaks
CREATE TRIGGER update_login_streaks_updated_at
  BEFORE UPDATE ON public.login_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();