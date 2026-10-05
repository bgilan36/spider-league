DROP POLICY IF EXISTS "Authenticated users can create matchups" ON public.matchups;

DROP POLICY IF EXISTS "Battles are viewable by participants" ON public.battles;
CREATE POLICY "Battles are viewable by participants" ON public.battles
FOR SELECT TO authenticated
USING (
  is_active = false
  OR (team_a->>'userId') = auth.uid()::text
  OR (team_b->>'userId') = auth.uid()::text
  OR current_turn_user_id = auth.uid()
  OR awaiting_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);