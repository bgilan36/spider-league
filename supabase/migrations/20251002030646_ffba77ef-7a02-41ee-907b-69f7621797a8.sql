-- Create pokes table
CREATE TABLE public.pokes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poker_user_id UUID NOT NULL,
  poked_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pokes_not_self CHECK (poker_user_id != poked_user_id),
  CONSTRAINT pokes_unique UNIQUE (poker_user_id, poked_user_id)
);

-- Enable RLS
ALTER TABLE public.pokes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can poke others"
ON public.pokes
FOR INSERT
WITH CHECK (auth.uid() = poker_user_id AND auth.uid() != poked_user_id);

CREATE POLICY "Users can view pokes they sent or received"
ON public.pokes
FOR SELECT
USING (auth.uid() = poker_user_id OR auth.uid() = poked_user_id);

CREATE POLICY "Users can delete pokes they sent"
ON public.pokes
FOR DELETE
USING (auth.uid() = poker_user_id);

-- Create index for faster queries
CREATE INDEX idx_pokes_poked_user_id ON public.pokes(poked_user_id);
CREATE INDEX idx_pokes_poker_user_id ON public.pokes(poker_user_id);