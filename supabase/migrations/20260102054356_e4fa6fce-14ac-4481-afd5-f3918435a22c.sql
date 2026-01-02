-- Create weekly_roster table for tracking activated spiders each week
CREATE TABLE public.weekly_roster (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  spider_id UUID NOT NULL REFERENCES public.spiders(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  slot_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Each user can only have one activated spider per week
  UNIQUE(user_id, week_start)
);

-- Enable Row Level Security
ALTER TABLE public.weekly_roster ENABLE ROW LEVEL SECURITY;

-- Users can view their own roster entries
CREATE POLICY "Users can view their own roster"
ON public.weekly_roster
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own roster entries
CREATE POLICY "Users can insert their own roster"
ON public.weekly_roster
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own roster entries
CREATE POLICY "Users can update their own roster"
ON public.weekly_roster
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own roster entries
CREATE POLICY "Users can delete their own roster"
ON public.weekly_roster
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_weekly_roster_user_week ON public.weekly_roster(user_id, week_start);

-- Add trigger for updated_at
CREATE TRIGGER update_weekly_roster_updated_at
  BEFORE UPDATE ON public.weekly_roster
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();