
-- =========================================================
-- REFERRALS TABLE
-- =========================================================
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  source_ref text,
  status text NOT NULL DEFAULT 'pending',
  qualified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_invitee_unique UNIQUE (invitee_id),
  CONSTRAINT referrals_no_self CHECK (inviter_id <> invitee_id),
  CONSTRAINT referrals_status_check CHECK (status IN ('pending','qualified'))
);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view referrals they're part of"
ON public.referrals FOR SELECT
TO authenticated
USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE TRIGGER referrals_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX referrals_inviter_idx ON public.referrals(inviter_id);
CREATE INDEX referrals_status_idx ON public.referrals(status);

-- =========================================================
-- ROSTER SLOT BONUSES (one row per user, cap of one bonus)
-- =========================================================
CREATE TABLE public.roster_slot_bonuses (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT 'referral',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.roster_slot_bonuses TO authenticated;
GRANT ALL ON public.roster_slot_bonuses TO service_role;

ALTER TABLE public.roster_slot_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roster bonuses"
ON public.roster_slot_bonuses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER roster_slot_bonuses_updated_at
BEFORE UPDATE ON public.roster_slot_bonuses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SEED BADGES
-- =========================================================
INSERT INTO public.badges (name, description, icon, rarity, color, criteria)
VALUES
  ('Bronze Recruiter', 'Recruited 1 friend who fought their first battle.', '🥉', 'common', '#cd7f32', '{"type":"referrals_qualified","target":1}'::jsonb),
  ('Silver Recruiter', 'Recruited 3 friends who fought their first battle.', '🥈', 'rare', '#c0c0c0', '{"type":"referrals_qualified","target":3}'::jsonb),
  ('Gold Recruiter', 'Recruited 5 friends who fought their first battle.', '🥇', 'epic', '#ffd700', '{"type":"referrals_qualified","target":5}'::jsonb),
  ('Legendary Recruiter', 'Recruited 10 friends who fought their first battle.', '👑', 'legendary', '#a855f7', '{"type":"referrals_qualified","target":10}'::jsonb),
  ('Drafted', 'Joined via a friend''s invite and fought your first battle.', '🎟️', 'rare', '#22c55e', '{"type":"drafted"}'::jsonb)
ON CONFLICT DO NOTHING;

-- =========================================================
-- FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.record_referral(
  p_inviter_id uuid,
  p_source text DEFAULT 'manual',
  p_source_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_inviter_id IS NULL OR p_inviter_id = v_user THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'invalid_inviter');
  END IF;
  -- Inviter must exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_inviter_id) THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'inviter_not_found');
  END IF;
  -- Only record if invitee is brand-new (created in last 7 days) to discourage backfilling
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user AND created_at > now() - interval '7 days'
  ) THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'invitee_too_old');
  END IF;

  INSERT INTO public.referrals (inviter_id, invitee_id, source, source_ref)
  VALUES (p_inviter_id, v_user, COALESCE(p_source, 'manual'), p_source_ref)
  ON CONFLICT (invitee_id) DO NOTHING;

  RETURN jsonb_build_object('recorded', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_referral(uuid, text, text) TO authenticated;

-- Helper: award a single badge by name (idempotent)
CREATE OR REPLACE FUNCTION public.award_badge_by_name(p_user_id uuid, p_badge_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_id uuid;
BEGIN
  SELECT id INTO v_badge_id FROM public.badges WHERE name = p_badge_name LIMIT 1;
  IF v_badge_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (p_user_id, v_badge_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Grant or refresh 30-day bonus slot (capped at one, refreshes expiry)
CREATE OR REPLACE FUNCTION public.grant_referral_slot_bonus(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.roster_slot_bonuses (user_id, expires_at, reason)
  VALUES (p_user_id, now() + interval '30 days', 'referral')
  ON CONFLICT (user_id) DO UPDATE
    SET expires_at = GREATEST(public.roster_slot_bonuses.expires_at, now() + interval '30 days'),
        updated_at = now();
END;
$$;

-- Award the appropriate recruiter tier based on qualified-referral count
CREATE OR REPLACE FUNCTION public.award_recruiter_tier(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.referrals
  WHERE inviter_id = p_user_id AND status = 'qualified';

  IF v_count >= 1  THEN PERFORM public.award_badge_by_name(p_user_id, 'Bronze Recruiter'); END IF;
  IF v_count >= 3  THEN PERFORM public.award_badge_by_name(p_user_id, 'Silver Recruiter'); END IF;
  IF v_count >= 5  THEN PERFORM public.award_badge_by_name(p_user_id, 'Gold Recruiter'); END IF;
  IF v_count >= 10 THEN PERFORM public.award_badge_by_name(p_user_id, 'Legendary Recruiter'); END IF;
END;
$$;

-- Qualify a referral upon first completed battle for the invitee
CREATE OR REPLACE FUNCTION public.qualify_referral_on_first_battle(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_ref FROM public.referrals
  WHERE invitee_id = p_user_id AND status = 'pending'
  LIMIT 1;

  IF v_ref IS NULL THEN RETURN; END IF;

  UPDATE public.referrals
  SET status = 'qualified', qualified_at = now(), updated_at = now()
  WHERE id = v_ref.id;

  -- Slot bonus for both
  PERFORM public.grant_referral_slot_bonus(v_ref.inviter_id);
  PERFORM public.grant_referral_slot_bonus(v_ref.invitee_id);

  -- Badges
  PERFORM public.award_badge_by_name(v_ref.invitee_id, 'Drafted');
  PERFORM public.award_recruiter_tier(v_ref.inviter_id);
END;
$$;

-- Trigger: battle ended on public.battles (is_active flipped to false with winner)
CREATE OR REPLACE FUNCTION public.trg_qualify_referrals_on_battle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
BEGIN
  IF NEW.is_active = false AND NEW.winner IS NOT NULL
     AND (OLD.is_active = true OR OLD.winner IS NULL) THEN
    BEGIN
      v_a := (NEW.team_a->>'userId')::uuid;
      v_b := (NEW.team_b->>'userId')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_a := NULL; v_b := NULL;
    END;
    IF v_a IS NOT NULL THEN PERFORM public.qualify_referral_on_first_battle(v_a); END IF;
    IF v_b IS NOT NULL THEN PERFORM public.qualify_referral_on_first_battle(v_b); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_qualify_on_battle ON public.battles;
CREATE TRIGGER trg_referral_qualify_on_battle
AFTER UPDATE ON public.battles
FOR EACH ROW EXECUTE FUNCTION public.trg_qualify_referrals_on_battle();

-- Trigger: spider skirmish insert with a winner
CREATE OR REPLACE FUNCTION public.trg_qualify_referrals_on_skirmish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opponent uuid;
BEGIN
  IF NEW.winner_side IS NOT NULL THEN
    IF NEW.initiator_user_id IS NOT NULL THEN
      PERFORM public.qualify_referral_on_first_battle(NEW.initiator_user_id);
    END IF;
    SELECT owner_id INTO v_opponent FROM public.spiders WHERE id = NEW.opponent_spider_id;
    IF v_opponent IS NOT NULL THEN
      PERFORM public.qualify_referral_on_first_battle(v_opponent);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_qualify_on_skirmish ON public.spider_skirmishes;
CREATE TRIGGER trg_referral_qualify_on_skirmish
AFTER INSERT ON public.spider_skirmishes
FOR EACH ROW EXECUTE FUNCTION public.trg_qualify_referrals_on_skirmish();

-- Progress accessor
CREATE OR REPLACE FUNCTION public.get_referral_progress(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := COALESCE(p_user_id, auth.uid());
  v_qualified int;
  v_pending int;
  v_current_tier text;
  v_next_tier text;
  v_next_target int;
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error','unauthorized');
  END IF;

  SELECT count(*) FILTER (WHERE status = 'qualified'),
         count(*) FILTER (WHERE status = 'pending')
  INTO v_qualified, v_pending
  FROM public.referrals WHERE inviter_id = v_user;

  v_current_tier := CASE
    WHEN v_qualified >= 10 THEN 'Legendary Recruiter'
    WHEN v_qualified >= 5 THEN 'Gold Recruiter'
    WHEN v_qualified >= 3 THEN 'Silver Recruiter'
    WHEN v_qualified >= 1 THEN 'Bronze Recruiter'
    ELSE NULL
  END;

  IF v_qualified < 1 THEN
    v_next_tier := 'Bronze Recruiter'; v_next_target := 1;
  ELSIF v_qualified < 3 THEN
    v_next_tier := 'Silver Recruiter'; v_next_target := 3;
  ELSIF v_qualified < 5 THEN
    v_next_tier := 'Gold Recruiter'; v_next_target := 5;
  ELSIF v_qualified < 10 THEN
    v_next_tier := 'Legendary Recruiter'; v_next_target := 10;
  ELSE
    v_next_tier := NULL; v_next_target := NULL;
  END IF;

  SELECT expires_at INTO v_expires FROM public.roster_slot_bonuses
  WHERE user_id = v_user AND expires_at > now();

  RETURN jsonb_build_object(
    'qualified_count', v_qualified,
    'pending_count', v_pending,
    'current_tier', v_current_tier,
    'next_tier', v_next_tier,
    'next_tier_target', v_next_target,
    'extra_slot_expires_at', v_expires,
    'extra_slot_active', v_expires IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_progress(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_roster_slot_count(p_user_id uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := COALESCE(p_user_id, auth.uid());
  v_has_bonus boolean;
BEGIN
  IF v_user IS NULL THEN RETURN 5; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.roster_slot_bonuses
    WHERE user_id = v_user AND expires_at > now()
  ) INTO v_has_bonus;
  RETURN 5 + CASE WHEN v_has_bonus THEN 1 ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_roster_slot_count(uuid) TO authenticated;
