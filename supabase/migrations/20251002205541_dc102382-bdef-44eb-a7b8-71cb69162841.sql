-- Add spider emoji reactions table
CREATE TABLE IF NOT EXISTS public.profile_wall_spider_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.profile_wall_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.profile_wall_spider_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all spider reactions"
  ON public.profile_wall_spider_reactions
  FOR SELECT
  USING (true);

CREATE POLICY "Users can add their own spider reactions"
  ON public.profile_wall_spider_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own spider reactions"
  ON public.profile_wall_spider_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Remove spider_id column from profile_wall_posts
ALTER TABLE public.profile_wall_posts DROP COLUMN IF EXISTS spider_id;