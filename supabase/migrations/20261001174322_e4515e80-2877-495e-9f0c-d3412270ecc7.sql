ALTER TABLE public.battle_challenges
  ADD COLUMN IF NOT EXISTS target_user_id uuid,
  ADD COLUMN IF NOT EXISTS challenger_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepter_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS challenger_stances jsonb,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS battle_challenges_idem_key ON public.battle_challenges(challenger_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS battle_challenges_target_idx ON public.battle_challenges(target_user_id) WHERE target_user_id IS NOT NULL;

ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS is_pvp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS turn_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS autoplay_user_id uuid;

-- All challenge writes now go through the server (challenge edge function).
DROP POLICY IF EXISTS "Users can create their own challenges" ON public.battle_challenges;
DROP POLICY IF EXISTS "Demo users cannot stake spiders" ON public.battle_challenges;
DROP POLICY IF EXISTS "Users can update challenges they created or accepted" ON public.battle_challenges;
DROP POLICY IF EXISTS "Demo users cannot accept staked challenges" ON public.battle_challenges;
DROP POLICY IF EXISTS "Users can delete their own challenges" ON public.battle_challenges;
DROP POLICY IF EXISTS "Users can view open challenges and their own challenges" ON public.battle_challenges;
CREATE POLICY "Users can view open challenges and their own challenges" ON public.battle_challenges
  FOR SELECT USING (
    auth.uid() = challenger_id OR auth.uid() = accepter_id OR auth.uid() = target_user_id
    OR (status = 'OPEN' AND expires_at > now())
  );

-- Battles are created and advanced only by server functions.
DROP POLICY IF EXISTS "Authenticated users can create battles" ON public.battles;
DROP POLICY IF EXISTS "Participants can update active battles" ON public.battles;

-- Rewards and ownership changes are server-only.
REVOKE EXECUTE ON FUNCTION public.transfer_spider_ownership(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_battle_challenge(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_spider_xp(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.improve_spider_after_victory(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_spider_ownership(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_battle_challenge(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_spider_xp(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.improve_spider_after_victory(uuid) TO service_role;