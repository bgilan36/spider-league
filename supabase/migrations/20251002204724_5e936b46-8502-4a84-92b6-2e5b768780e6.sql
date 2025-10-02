-- Add spider_id column to profile_wall_posts for attaching spiders
ALTER TABLE public.profile_wall_posts 
ADD COLUMN IF NOT EXISTS spider_id UUID REFERENCES public.spiders(id) ON DELETE SET NULL;

-- Create index for spider_id lookups
CREATE INDEX IF NOT EXISTS idx_profile_wall_posts_spider_id ON public.profile_wall_posts(spider_id);

-- Create table for wall post likes
CREATE TABLE IF NOT EXISTS public.profile_wall_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.profile_wall_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- Enable RLS on profile_wall_likes
ALTER TABLE public.profile_wall_likes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for wall post likes
CREATE POLICY "Users can view all likes"
  ON public.profile_wall_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own likes"
  ON public.profile_wall_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON public.profile_wall_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for efficient like queries
CREATE INDEX IF NOT EXISTS idx_profile_wall_likes_post_id ON public.profile_wall_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_profile_wall_likes_user_id ON public.profile_wall_likes(user_id);

-- Create table for wall post replies
CREATE TABLE IF NOT EXISTS public.profile_wall_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.profile_wall_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on profile_wall_replies
ALTER TABLE public.profile_wall_replies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for wall post replies
CREATE POLICY "Replies are viewable by everyone"
  ON public.profile_wall_replies FOR SELECT
  USING (true);

CREATE POLICY "Users can create replies"
  ON public.profile_wall_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies"
  ON public.profile_wall_replies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies or replies on their wall"
  ON public.profile_wall_replies FOR DELETE
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.profile_wall_posts 
      WHERE profile_wall_posts.id = profile_wall_replies.post_id 
      AND profile_wall_posts.profile_user_id = auth.uid()
    )
  );

-- Create indexes for efficient reply queries
CREATE INDEX IF NOT EXISTS idx_profile_wall_replies_post_id ON public.profile_wall_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_profile_wall_replies_user_id ON public.profile_wall_replies(user_id);

-- Create trigger for sanitizing reply messages (reusing existing sanitize_wall_post_message trigger function)
CREATE TRIGGER trigger_sanitize_wall_reply_message
  BEFORE INSERT OR UPDATE ON public.profile_wall_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sanitize_wall_post_message();

-- Add updated_at trigger for replies
CREATE TRIGGER update_wall_replies_updated_at
  BEFORE UPDATE ON public.profile_wall_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();