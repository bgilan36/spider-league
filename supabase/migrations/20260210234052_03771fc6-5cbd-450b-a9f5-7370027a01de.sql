-- Allow users to delete their own challenges (needed for auto-cancel logic)
CREATE POLICY "Users can delete their own challenges"
ON public.battle_challenges
FOR DELETE
USING (auth.uid() = challenger_id);
