
-- 1. Realtime authorization for pod chat channels
-- Restrict subscriptions to pod-chat-* topics to league members only
DROP POLICY IF EXISTS "Pod chat realtime access" ON realtime.messages;
CREATE POLICY "Pod chat realtime access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'pod-chat-%' THEN
      public.is_private_league_member(
        NULLIF(substring(realtime.topic() from 10), '')::uuid,
        (SELECT auth.uid())
      )
    ELSE true
  END
);

-- 2. private_league_members: require a valid active invite to self-join
CREATE POLICY "Users can join via valid invite"
ON public.private_league_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.private_league_invites pli
    WHERE pli.league_id = private_league_members.league_id
      AND pli.is_active = true
      AND (pli.expires_at IS NULL OR pli.expires_at > now())
      AND (pli.max_uses IS NULL OR pli.use_count < pli.max_uses)
  )
);

-- 3. profile_wall_posts: allow users to post on their own wall
DROP POLICY IF EXISTS "Users can post on others' walls" ON public.profile_wall_posts;
CREATE POLICY "Users can post on walls"
ON public.profile_wall_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = poster_user_id AND auth.uid() IS NOT NULL);

-- 4. battles: prevent non-admin participants from tampering with protected fields
CREATE OR REPLACE FUNCTION public.prevent_battle_field_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass; service_role bypasses RLS so doesn't hit this check via policy
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.winner IS DISTINCT FROM OLD.winner
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.team_a IS DISTINCT FROM OLD.team_a
       OR NEW.team_b IS DISTINCT FROM OLD.team_b
       OR NEW.rng_seed IS DISTINCT FROM OLD.rng_seed
       OR NEW.challenge_id IS DISTINCT FROM OLD.challenge_id
       OR NEW.league_id IS DISTINCT FROM OLD.league_id
       OR NEW.stakes_type IS DISTINCT FROM OLD.stakes_type THEN
      RAISE EXCEPTION 'Not allowed to modify protected battle fields directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS battles_prevent_tampering ON public.battles;
CREATE TRIGGER battles_prevent_tampering
BEFORE UPDATE ON public.battles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_battle_field_tampering();
