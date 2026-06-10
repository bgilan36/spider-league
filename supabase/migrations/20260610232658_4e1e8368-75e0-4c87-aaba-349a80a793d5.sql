
CREATE OR REPLACE FUNCTION public.resolve_battle_challenge(challenge_id uuid, winner_user_id uuid, loser_user_id uuid, battle_id_param uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  challenge_record RECORD;
  loser_spider UUID; winner_spider UUID;
  stat_improvements JSONB;
  v_is_all_or_nothing boolean;
  v_winner_spider_xp int; v_loser_spider_xp int;
  v_winner_xp_result jsonb; v_loser_xp_result jsonb;
  v_seed text; v_streak int;
BEGIN
  SELECT * INTO challenge_record FROM public.battle_challenges WHERE id = challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;

  v_is_all_or_nothing := (challenge_record.is_all_or_nothing = true);
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
  stat_improvements := public.improve_spider_after_victory(winner_spider);

  IF v_is_all_or_nothing THEN
    PERFORM public.transfer_spider_ownership(loser_spider, winner_user_id);
  END IF;

  v_winner_xp_result := public.award_spider_xp(winner_spider, v_winner_spider_xp, v_seed);
  v_loser_xp_result  := public.award_spider_xp(loser_spider,  v_loser_spider_xp,  v_seed);

  UPDATE public.battle_challenges
  SET status = 'COMPLETED', battle_id = battle_id_param,
      winner_id = winner_user_id, loser_spider_id = loser_spider
  WHERE id = challenge_id;

  UPDATE public.profiles
  SET current_win_streak = current_win_streak + 1,
      longest_win_streak = GREATEST(longest_win_streak, current_win_streak + 1)
  WHERE id = winner_user_id;
  UPDATE public.profiles SET current_win_streak = 0 WHERE id = loser_user_id;
  SELECT current_win_streak INTO v_streak FROM public.profiles WHERE id = winner_user_id;

  UPDATE public.spiders SET last_battled_at = now()
  WHERE id = challenge_record.challenger_spider_id;

  RETURN stat_improvements || jsonb_build_object(
    'stakes_type', CASE WHEN v_is_all_or_nothing THEN 'all_or_nothing' ELSE 'training' END,
    'spider_transferred', v_is_all_or_nothing,
    'win_streak', v_streak,
    'spider_xp', jsonb_build_object('winner', v_winner_xp_result, 'loser', v_loser_xp_result)
  );
END; $$;

-- ====== BACKFILL ======
-- Compute earned XP per spider from completed battle_challenges and spider_skirmishes,
-- then set xp, level, and level_power_bonus on each spider, adding the +5 per level bonus
-- to power_score (delta from any previously-stored level_power_bonus).
WITH challenge_winner_xp AS (
  SELECT
    CASE WHEN bc.winner_id = bc.challenger_id THEN bc.challenger_spider_id ELSE bc.accepter_spider_id END AS spider_id,
    SUM(CASE WHEN bc.is_all_or_nothing THEN 50 ELSE 25 END)::int AS xp_amt
  FROM public.battle_challenges bc
  WHERE bc.status = 'COMPLETED' AND bc.winner_id IS NOT NULL
  GROUP BY 1
),
challenge_loser_xp AS (
  SELECT bc.loser_spider_id AS spider_id, (10 * COUNT(*))::int AS xp_amt
  FROM public.battle_challenges bc
  WHERE bc.status = 'COMPLETED' AND bc.loser_spider_id IS NOT NULL
  GROUP BY 1
),
skirmish_winner_xp AS (
  SELECT s.winner_spider_id AS spider_id, (25 * COUNT(*))::int AS xp_amt
  FROM public.spider_skirmishes s
  WHERE s.winner_side IS NOT NULL AND s.winner_spider_id IS NOT NULL
  GROUP BY 1
),
skirmish_loser_xp AS (
  SELECT
    CASE WHEN s.winner_side = 'A' THEN s.opponent_spider_id ELSE s.player_spider_id END AS spider_id,
    (10 * COUNT(*))::int AS xp_amt
  FROM public.spider_skirmishes s
  WHERE s.winner_side IS NOT NULL
  GROUP BY 1
),
totals AS (
  SELECT spider_id, SUM(xp_amt)::int AS total_xp FROM (
    SELECT * FROM challenge_winner_xp
    UNION ALL SELECT * FROM challenge_loser_xp
    UNION ALL SELECT * FROM skirmish_winner_xp
    UNION ALL SELECT * FROM skirmish_loser_xp
  ) u WHERE spider_id IS NOT NULL
  GROUP BY spider_id
),
computed AS (
  SELECT
    sp.id,
    GREATEST(COALESCE(t.total_xp, 0), sp.xp) AS new_xp,
    public.calculate_spider_level(GREATEST(COALESCE(t.total_xp, 0), sp.xp)) AS new_level,
    sp.level_power_bonus AS old_bonus,
    (public.calculate_spider_level(GREATEST(COALESCE(t.total_xp, 0), sp.xp)) - 1) * 5 AS new_bonus
  FROM public.spiders sp
  LEFT JOIN totals t ON t.spider_id = sp.id
)
UPDATE public.spiders sp
SET xp = c.new_xp,
    level = c.new_level,
    level_power_bonus = c.new_bonus,
    power_score = sp.power_score + (c.new_bonus - c.old_bonus),
    updated_at = now()
FROM computed c
WHERE sp.id = c.id
  AND (sp.xp IS DISTINCT FROM c.new_xp
       OR sp.level IS DISTINCT FROM c.new_level
       OR sp.level_power_bonus IS DISTINCT FROM c.new_bonus);
