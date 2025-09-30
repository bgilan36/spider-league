-- Create profile wall posts table
CREATE TABLE public.profile_wall_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_user_id UUID NOT NULL,
  poster_user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profile_wall_posts ENABLE ROW LEVEL SECURITY;

-- Create policies for wall posts
-- Everyone can view wall posts
CREATE POLICY "Wall posts are viewable by everyone"
ON public.profile_wall_posts
FOR SELECT
USING (true);

-- Authenticated users can create wall posts (but not on their own profile)
CREATE POLICY "Users can post on others' walls"
ON public.profile_wall_posts
FOR INSERT
WITH CHECK (
  auth.uid() = poster_user_id 
  AND auth.uid() != profile_user_id
  AND auth.uid() IS NOT NULL
);

-- Users can update their own wall posts
CREATE POLICY "Users can update their own wall posts"
ON public.profile_wall_posts
FOR UPDATE
USING (auth.uid() = poster_user_id);

-- Users can delete their own posts OR profile owners can delete posts on their wall
CREATE POLICY "Users can delete own posts or posts on their wall"
ON public.profile_wall_posts
FOR DELETE
USING (
  auth.uid() = poster_user_id 
  OR auth.uid() = profile_user_id
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profile_wall_posts_updated_at
BEFORE UPDATE ON public.profile_wall_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to sanitize wall post messages
CREATE OR REPLACE FUNCTION public.trigger_sanitize_wall_post_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.message := public.sanitize_plain_text(NEW.message);
  RETURN NEW;
END;
$$;

-- Create trigger to sanitize wall post messages
CREATE TRIGGER sanitize_wall_post_message
BEFORE INSERT OR UPDATE ON public.profile_wall_posts
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sanitize_wall_post_message();

-- Add index for faster queries
CREATE INDEX idx_profile_wall_posts_profile_user_id ON public.profile_wall_posts(profile_user_id);
CREATE INDEX idx_profile_wall_posts_created_at ON public.profile_wall_posts(created_at DESC);