-- Fix the battle challenges RLS policy to properly show open challenges to all authenticated users
DROP POLICY IF EXISTS "Users can view open challenges and their own challenges" ON public.battle_challenges;

CREATE POLICY "Users can view open challenges and their own challenges"
ON public.battle_challenges
FOR SELECT
TO authenticated
USING (
  -- Users can see their own challenges (as challenger or accepter)
  auth.uid() = challenger_id OR 
  auth.uid() = accepter_id OR
  -- Users can see all open challenges that haven't expired
  (status = 'OPEN' AND expires_at > now())
);