-- Fix: Restrict profile access to authenticated users only
-- This prevents public scraping while maintaining gaming functionality

-- Drop the existing public read policy
DROP POLICY IF EXISTS "Public read access to gaming profile data" ON public.profiles;

-- Create new policy: Only authenticated users can view profiles
CREATE POLICY "Authenticated users can view gaming profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Note: Users can still view their own profiles via "Users can update their own profile" policy
-- This change prevents unauthenticated public access while maintaining full functionality
-- for logged-in players who need to see leaderboards, opponent profiles, etc.