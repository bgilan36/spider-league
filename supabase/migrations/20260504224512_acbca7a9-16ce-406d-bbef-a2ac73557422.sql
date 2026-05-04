-- Remove direct INSERT on user_badges; awards must flow through award_badges_for_user RPC (SECURITY DEFINER)
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;

-- Restrict matchups SELECT to authenticated users (hide team compositions from anonymous viewers)
DROP POLICY IF EXISTS "Matchups are viewable by everyone" ON public.matchups;
CREATE POLICY "Matchups viewable by authenticated users"
ON public.matchups
FOR SELECT
TO authenticated
USING (true);