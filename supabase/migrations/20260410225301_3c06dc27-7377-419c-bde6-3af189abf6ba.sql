
-- 1. battle_challenges: add All-or-Nothing flag
ALTER TABLE public.battle_challenges
  ADD COLUMN IF NOT EXISTS is_all_or_nothing boolean NOT NULL DEFAULT false;

-- 2. battles: add stakes_type
ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS stakes_type text NOT NULL DEFAULT 'training';

-- 3. spiders: add rolling eligibility + cooldown
ALTER TABLE public.spiders
  ADD COLUMN IF NOT EXISTS eligible_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_battled_at timestamptz DEFAULT NULL;

-- 4. profiles: add win streak columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_win_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_win_streak integer NOT NULL DEFAULT 0;

-- 5. Backfill eligible_until for existing approved spiders (30 days from creation, minimum now + 7 days)
UPDATE public.spiders
SET eligible_until = GREATEST(created_at + interval '30 days', now() + interval '7 days')
WHERE eligible_until IS NULL AND is_approved = true;

-- 6. Trigger to auto-set eligible_until on new spider inserts
CREATE OR REPLACE FUNCTION public.set_spider_eligible_until()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.eligible_until IS NULL THEN
    NEW.eligible_until := now() + interval '30 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_spider_eligible_until ON public.spiders;
CREATE TRIGGER trg_set_spider_eligible_until
  BEFORE INSERT ON public.spiders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_spider_eligible_until();

-- 7. Update resolve_battle_challenge to conditionally transfer ownership based on stakes
CREATE OR REPLACE FUNCTION public.resolve_battle_challenge(challenge_id uuid, winner_user_id uuid, loser_user_id uuid, battle_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  challenge_record RECORD;
  battle_record RECORD;
  loser_spider UUID;
  winner_spider UUID;
  stat_improvements JSONB;
  v_is_all_or_nothing boolean;
  v_battle_xp int;
  v_winner_spider_xp int;
  v_loser_spider_xp int;
  v_winner_xp_result jsonb;
  v_loser_xp_result jsonb;
  v_seed text;
BEGIN
  SELECT * INTO challenge_record
  FROM public.battle_challenges
  WHERE id = challenge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  -- Get stakes type from the battle record
  SELECT stakes_type INTO battle_record
  FROM public.battles
  WHERE id = battle_id_param;

  v_is_all_or_nothing := (challenge_record.is_all_or_nothing = true);

  -- Set reward amounts based on stakes
  IF v_is_all_or_nothing THEN
    v_battle_xp := 25;
    v_winner_spider_xp := 30;
    v_loser_spider_xp := 10;
  ELSE
    v_battle_xp := 12;
    v_winner_spider_xp := 15;
    v_loser_spider_xp := 5;
  END IF;

  IF winner_user_id = challenge_record.challenger_id THEN
    loser_spider := challenge_record.accepter_spider_id;
    winner_spider := challenge_record.challenger_spider_id;
  ELSE
    loser_spider := challenge_record.challenger_spider_id;
    winner_spider := challenge_record.accepter_spider_id;
  END IF;

  v_seed := encode(gen_random_bytes(8), 'hex');

  -- Improve winning spider stats
  stat_improvements := public.improve_spider_after_victory(winner_spider);

  -- Only transfer ownership for All-or-Nothing battles
  IF v_is_all_or_nothing THEN
    PERFORM public.transfer_spider_ownership(loser_spider, winner_user_id);
  END IF;

  -- Award XP to battle winner
  UPDATE public.profiles SET xp = xp + v_battle_xp WHERE id = winner_user_id;

  -- Award spider XP
  v_winner_xp_result := public.award_spider_xp(winner_spider, v_winner_spider_xp, v_seed);
  v_loser_xp_result := public.award_spider_xp(loser_spider, v_loser_spider_xp, v_seed);

  -- Update challenge status
  UPDATE public.battle_challenges
  SET status = 'COMPLETED',
      battle_id = battle_id_param,
      winner_id = winner_user_id,
      loser_spider_id = loser_spider
  WHERE id = challenge_id;

  -- Update win streaks
  UPDATE public.profiles
  SET current_win_streak = current_win_streak + 1,
      longest_win_streak = GREATEST(longest_win_streak, current_win_streak + 1)
  WHERE id = winner_user_id;

  UPDATE public.profiles
  SET current_win_streak = 0
  WHERE id = loser_user_id;

  -- Award streak bonus XP (+5 per streak level, applied after increment)
  DECLARE
    v_streak int;
    v_streak_bonus int;
  BEGIN
    SELECT current_win_streak INTO v_streak FROM public.profiles WHERE id = winner_user_id;
    IF v_streak >= 3 THEN
      v_streak_bonus := v_streak * 5;
      UPDATE public.profiles SET xp = xp + v_streak_bonus WHERE id = winner_user_id;
    ELSE
      v_streak_bonus := 0;
    END IF;

    -- Update last_battled_at for both spiders
    UPDATE public.spiders SET last_battled_at = now() WHERE id IN (winner_spider, loser_spider);

    RETURN stat_improvements || jsonb_build_object(
      'battle_xp_awarded', v_battle_xp,
      'stakes_type', CASE WHEN v_is_all_or_nothing THEN 'all_or_nothing' ELSE 'training' END,
      'spider_transferred', v_is_all_or_nothing,
      'win_streak', v_streak,
      'streak_bonus_xp', v_streak_bonus,
      'spider_xp', jsonb_build_object(
        'winner', v_winner_xp_result,
        'loser', v_loser_xp_result
      )
    );
  END;
END;
$$;
