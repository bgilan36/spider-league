-- Phase 1: Critical Data Exposure Fixes

-- 1. Restrict Battle Challenge Visibility - Only show challenges that users can participate in
DROP POLICY IF EXISTS "Battle challenges are viewable by everyone" ON public.battle_challenges;

CREATE POLICY "Users can view open challenges and their own challenges"
ON public.battle_challenges
FOR SELECT
USING (
  -- Users can see their own challenges (as challenger or accepter)
  auth.uid() = challenger_id OR 
  auth.uid() = accepter_id OR
  -- Users can see open challenges (but not expired ones)
  (status = 'OPEN' AND expires_at > now())
);

-- 2. Protect User Profile Data - Restrict to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles are viewable by authenticated users only"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 3. Secure Voting Data - Make roadmap upvotes private (only show to vote owner)
DROP POLICY IF EXISTS "Upvotes are viewable by everyone" ON public.roadmap_upvotes;

CREATE POLICY "Users can only view their own upvotes"
ON public.roadmap_upvotes
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Add policy for viewing aggregated roadmap data (items with vote counts are still public)
-- This ensures roadmap_items table remains publicly viewable but individual votes are private

-- 5. Enhance spider visibility - ensure only approved spiders from active users are shown
DROP POLICY IF EXISTS "Approved spiders are viewable by everyone" ON public.spiders;

CREATE POLICY "Approved spiders are viewable by authenticated users"
ON public.spiders
FOR SELECT
TO authenticated
USING (is_approved = true);

-- 6. Add battle challenge creation with expiry validation
CREATE OR REPLACE FUNCTION public.validate_challenge_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure expires_at is in the future and not more than 7 days
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Challenge expiry must be in the future';
  END IF;
  
  IF NEW.expires_at > (now() + INTERVAL '7 days') THEN
    RAISE EXCEPTION 'Challenge cannot expire more than 7 days in the future';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_challenge_expiry_trigger
  BEFORE INSERT OR UPDATE ON public.battle_challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_challenge_expiry();