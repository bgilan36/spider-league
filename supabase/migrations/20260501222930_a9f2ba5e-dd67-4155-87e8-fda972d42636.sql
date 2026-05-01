ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'interactive',
  ADD COLUMN IF NOT EXISTS stances JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS awaiting_action TEXT,
  ADD COLUMN IF NOT EXISTS awaiting_user_id UUID;

-- Allow battle participants to update the live battle (HP, awaiting state, turn count)
-- so the interactive flow can progress without service-role calls for read-modify-write.
-- The edge function still runs with service role for authoritative writes; this policy
-- supports realtime-friendly state updates from participants too.
DROP POLICY IF EXISTS "Participants can update active battles" ON public.battles;
CREATE POLICY "Participants can update active battles"
ON public.battles
FOR UPDATE
TO authenticated
USING (
  is_active = true
  AND (
    ((team_a ->> 'userId')::uuid = auth.uid())
    OR ((team_b ->> 'userId')::uuid = auth.uid())
  )
)
WITH CHECK (
  ((team_a ->> 'userId')::uuid = auth.uid())
  OR ((team_b ->> 'userId')::uuid = auth.uid())
);
