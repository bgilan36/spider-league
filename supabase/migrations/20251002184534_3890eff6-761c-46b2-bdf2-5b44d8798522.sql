-- Create user_presence table for real-time presence tracking
CREATE TABLE IF NOT EXISTS public.user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view presence"
  ON public.user_presence
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own presence"
  ON public.user_presence
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence"
  ON public.user_presence
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presence"
  ON public.user_presence
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for efficient queries
CREATE INDEX user_presence_last_seen_idx ON public.user_presence(last_seen DESC);
CREATE INDEX user_presence_user_id_idx ON public.user_presence(user_id);

-- Enable realtime
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

-- Create a function to clean up stale presence (older than 1 minute)
CREATE OR REPLACE FUNCTION public.cleanup_stale_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.user_presence
  WHERE last_seen < now() - INTERVAL '1 minute';
END;
$$;