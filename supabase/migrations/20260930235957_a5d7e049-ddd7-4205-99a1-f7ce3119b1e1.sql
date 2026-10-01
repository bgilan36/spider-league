
CREATE OR REPLACE FUNCTION public.resolve_battle_challenge(challenge_id uuid, winner_user_id uuid, loser_user_id uuid, battle_id_param uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  challenge_record RECORD;
  loser_spider UUID; winner_spider UUID;
  stat_improvements JSONB := '{}'::jsonb;
  v_is_all_or_nothing boolean;
  v_winner_spider_xp int; v_loser_spider_xp int;
  v_winner_xp_result jsonb; v_loser_xp_result jsonb;
  v_seed text; v_streak int;
  v_demo_involved boolean; v_winner_demo boolean; v_loser_demo boolean;
BEGIN
  SELECT * INTO challenge_record FROM public.battle_challenges WHERE id = challenge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;

  IF coalesce(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM challenge_record.challenger_id
     AND auth.uid() IS DISTINCT FROM challenge_record.accepter_id THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  -- Idempotent: a completed challenge is never rewarded twice.
  IF challenge_record.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('already_resolved', true, 'winner_id', challenge_record.winner_id);
  END IF;

  v_winner_demo := public.is_demo_user(winner_user_id);
  v_loser_demo := public.is_demo_user(loser_user_id);
  v_demo_involved := v_winner_demo OR v_loser_demo;

  v_is_all_or_nothing := (challenge_record.is_all_or_nothing = true) AND NOT v_demo_involved;
  v_winner_spider_xp := CASE WHEN v_is_all_or_nothing THEN 50 ELSE 25 END;
  v_loser_spider_xp := 10;

  IF winner_user_id = challenge_record.challenger_id THEN
    loser_spider := challenge_record.accepter_spider_id;
    winner_spider := challenge_record.challenger_spider_id;
  ELSE
    loser_spider := challenge_record.challenger_spider_id;
    winner_spider := challenge_record.accepter_spider_id;
  END IF;

  v_seed := encode(public.gen_random_bytes(8), 'hex');

  IF NOT v_demo_involved OR v_winner_demo THEN
    stat_improvements := public.improve_spider_after_victory(winner_spider);
    v_winner_xp_result := public.award_spider_xp(winner_spider, v_winner_spider_xp, v_seed);
  END IF;
  IF NOT v_demo_involved OR v_loser_demo THEN
    v_loser_xp_result := public.award_spider_xp(loser_spider, v_loser_spider_xp, v_seed);
  END IF;

  IF v_is_all_or_nothing THEN
    PERFORM public.transfer_spider_ownership(loser_spider, winner_user_id);
  END IF;

  UPDATE public.battle_challenges
  SET status = 'COMPLETED', battle_id = battle_id_param, winner_id = winner_user_id, loser_spider_id = loser_spider
  WHERE id = challenge_id;

  IF NOT v_demo_involved OR v_winner_demo THEN
    UPDATE public.profiles SET current_win_streak = current_win_streak + 1,
      longest_win_streak = GREATEST(longest_win_streak, current_win_streak + 1)
    WHERE id = winner_user_id;
  END IF;
  IF NOT v_demo_involved OR v_loser_demo THEN
    UPDATE public.profiles SET current_win_streak = 0 WHERE id = loser_user_id;
  END IF;
  SELECT current_win_streak INTO v_streak FROM public.profiles WHERE id = winner_user_id;

  UPDATE public.spiders SET last_battled_at = now() WHERE id = challenge_record.challenger_spider_id;

  RETURN coalesce(stat_improvements, '{}'::jsonb) || jsonb_build_object(
    'stakes_type', CASE WHEN v_is_all_or_nothing THEN 'all_or_nothing' ELSE 'training' END,
    'spider_transferred', v_is_all_or_nothing,
    'win_streak', v_streak,
    'demo', v_demo_involved,
    'spider_xp', jsonb_build_object('winner', v_winner_xp_result, 'loser', v_loser_xp_result)
  );
END; $function$;
