-- Drop the existing public SELECT policy on profiles
DROP POLICY IF EXISTS "Authenticated users can view gaming profiles" ON public.profiles;

-- Create a new policy that requires authentication to view profiles
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- This ensures only logged-in users can view profile data
-- while still allowing them to see other players' profiles for game functionality