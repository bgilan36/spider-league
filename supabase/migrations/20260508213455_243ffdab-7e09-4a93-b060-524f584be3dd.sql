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
  v_winner_power int;
  v_loser_power int;
  v_ratio numeric;
  v_xp_mult numeric;
  v_wpd int;
BEGIN
  SELECT * INTO challenge_record
  FROM public.battle_challenges
  WHERE id = challenge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  SELECT stakes_type INTO battle_record
  FROM public.battles
  WHERE id = battle_id_param;

  v_is_all_or_nothing := (challenge_record.is_all_or_nothing = true);

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

  SELECT COALESCE(power_score, 0) INTO v_winner_power FROM public.spiders WHERE id = winner_spider;
  SELECT COALESCE(power_score, 0) INTO v_loser_power  FROM public.spiders WHERE id = loser_spider;
  v_ratio := v_winner_power::numeric / GREATEST(1, v_loser_power);

  IF v_ratio >= 1.5 THEN
    v_xp_mult := 0.0;
  ELSIF v_ratio >= 1.2 THEN
    v_xp_mult := 0.25;
  ELSIF v_ratio >= 0.9 THEN
    v_xp_mult := 1.0;
  ELSE
    v_xp_mult := 1.5;
  END IF;

  v_battle_xp        := GREATEST(0, FLOOR(v_battle_xp        * v_xp_mult)::int);
  v_winner_spider_xp := GREATEST(0, FLOOR(v_winner_spider_xp * v_xp_mult)::int);
  v_loser_spider_xp  := GREATEST(0, FLOOR(v_loser_spider_xp  * v_xp_mult)::int);

  v_wpd := GREATEST(0, v_loser_power - v_winner_power);

  stat_improvements := public.improve_spider_after_victory(winner_spider);

  IF v_is_all_or_nothing THEN
    PERFORM public.transfer_spider_ownership(loser_spider, winner_user_id);
  END IF;

  IF v_battle_xp > 0 THEN
    UPDATE public.profiles SET xp = xp + v_battle_xp WHERE id = winner_user_id;
  END IF;

  v_winner_xp_result := public.award_spider_xp(winner_spider, v_winner_spider_xp, v_seed);
  v_loser_xp_result  := public.award_spider_xp(loser_spider,  v_loser_spider_xp,  v_seed);

  UPDATE public.battle_challenges
  SET status = 'COMPLETED',
      battle_id = battle_id_param,
      winner_id = winner_user_id,
      loser_spider_id = loser_spider
  WHERE id = challenge_id;

  UPDATE public.profiles
  SET current_win_streak = current_win_streak + 1,
      longest_win_streak = GREATEST(longest_win_streak, current_win_streak + 1)
  WHERE id = winner_user_id;

  UPDATE public.profiles
  SET current_win_streak = 0
  WHERE id = loser_user_id;

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

    -- Cooldown only applies to the initiator (challenger) spider, not the opponent.
    UPDATE public.spiders
    SET last_battled_at = now()
    WHERE id = challenge_record.challenger_spider_id;

    RETURN stat_improvements || jsonb_build_object(
      'battle_xp_awarded', v_battle_xp,
      'stakes_type', CASE WHEN v_is_all_or_nothing THEN 'all_or_nothing' ELSE 'training' END,
      'spider_transferred', v_is_all_or_nothing,
      'win_streak', v_streak,
      'streak_bonus_xp', v_streak_bonus,
      'winner_power', v_winner_power,
      'loser_power', v_loser_power,
      'power_ratio', v_ratio,
      'xp_multiplier', v_xp_mult,
      'wpd_awarded', v_wpd,
      'spider_xp', jsonb_build_object(
        'winner', v_winner_xp_result,
        'loser', v_loser_xp_result
      )
    );
  END;
END;
$$;