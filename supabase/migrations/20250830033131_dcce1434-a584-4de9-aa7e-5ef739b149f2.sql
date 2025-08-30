-- Create battle challenges table for the new Battle Mode
CREATE TABLE public.battle_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_id UUID NOT NULL,
  challenger_spider_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACCEPTED', 'COMPLETED', 'CANCELLED')),
  challenge_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  accepter_id UUID,
  accepter_spider_id UUID,
  battle_id UUID,
  winner_id UUID,
  loser_spider_id UUID
);

-- Add indexes for performance
CREATE INDEX idx_battle_challenges_status ON public.battle_challenges(status);
CREATE INDEX idx_battle_challenges_expires_at ON public.battle_challenges(expires_at);
CREATE INDEX idx_battle_challenges_challenger ON public.battle_challenges(challenger_id);

-- Enable RLS
ALTER TABLE public.battle_challenges ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Battle challenges are viewable by everyone" 
ON public.battle_challenges 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own challenges" 
ON public.battle_challenges 
FOR INSERT 
WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can update challenges they created or accepted" 
ON public.battle_challenges 
FOR UPDATE 
USING (auth.uid() = challenger_id OR auth.uid() = accepter_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_battle_challenges_updated_at
BEFORE UPDATE ON public.battle_challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to transfer spider ownership after battle
CREATE OR REPLACE FUNCTION public.transfer_spider_ownership(
  spider_id UUID,
  new_owner_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.spiders 
  SET owner_id = new_owner_id,
      updated_at = now()
  WHERE id = spider_id;
END;
$function$;

-- Function to resolve battle and transfer ownership
CREATE OR REPLACE FUNCTION public.resolve_battle_challenge(
  challenge_id UUID,
  winner_user_id UUID,
  loser_user_id UUID,
  battle_id_param UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  challenge_record RECORD;
  loser_spider UUID;
BEGIN
  -- Get challenge details
  SELECT * INTO challenge_record
  FROM public.battle_challenges
  WHERE id = challenge_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;
  
  -- Determine which spider gets transferred
  IF winner_user_id = challenge_record.challenger_id THEN
    loser_spider := challenge_record.accepter_spider_id;
  ELSE
    loser_spider := challenge_record.challenger_spider_id;
  END IF;
  
  -- Transfer spider ownership
  PERFORM public.transfer_spider_ownership(loser_spider, winner_user_id);
  
  -- Update challenge status
  UPDATE public.battle_challenges
  SET status = 'COMPLETED',
      battle_id = battle_id_param,
      winner_id = winner_user_id,
      loser_spider_id = loser_spider
  WHERE id = challenge_id;
END;
$function$;