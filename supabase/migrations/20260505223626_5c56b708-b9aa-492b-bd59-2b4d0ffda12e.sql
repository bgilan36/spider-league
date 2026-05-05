-- Power-aware XP and Win Point Differential standings

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

  -- Power-aware XP scaling
  SELECT COALESCE(power_score, 0) INTO v_winner_power FROM public.spiders WHERE id = winner_spider;
  SELECT COALESCE(power_score, 0) INTO v_loser_power  FROM public.spiders WHERE id = loser_spider;
  v_ratio := v_winner_power::numeric / GREATEST(1, v_loser_power);

  IF v_ratio >= 1.5 THEN
    v_xp_mult := 0.0;     -- trivial mismatch, no reward
  ELSIF v_ratio >= 1.2 THEN
    v_xp_mult := 0.25;
  ELSIF v_ratio >= 0.9 THEN
    v_xp_mult := 1.0;
  ELSE
    v_xp_mult := 1.5;     -- upset
  END IF;

  v_battle_xp        := GREATEST(0, FLOOR(v_battle_xp        * v_xp_mult)::int);
  v_winner_spider_xp := GREATEST(0, FLOOR(v_winner_spider_xp * v_xp_mult)::int);
  v_loser_spider_xp  := GREATEST(0, FLOOR(v_loser_spider_xp  * v_xp_mult)::int);

  -- Win Point Differential awarded on this battle (winner side only; symmetric loss applied to loser by standings query)
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

    UPDATE public.spiders SET last_battled_at = now() WHERE id IN (winner_spider, loser_spider);

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

-- Standings: rank by Win Point Differential as primary metric
CREATE OR REPLACE FUNCTION public.get_private_league_standings(league_id uuid, timeframe text DEFAULT 'weekly'::text)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  wins integer,
  losses integer,
  battles integer,
  win_rate numeric,
  streak integer,
  power_diff integer,
  top_spider jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_since timestamptz;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_private_league_member(get_private_league_standings.league_id, v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF get_private_league_standings.timeframe = 'weekly' THEN
    v_since := public.get_current_pt_week_start();
  ELSE
    v_since := 'epoch'::timestamptz;
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT m.user_id, p.display_name, p.avatar_url
    FROM public.private_league_members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.league_id = get_private_league_standings.league_id
  ), battle_rows AS (
    SELECT
      b.id,
      b.created_at,
      (b.team_a->>'userId')::uuid AS a_user,
      (b.team_b->>'userId')::uuid AS b_user,
      COALESCE(NULLIF(b.team_a #>> '{spider,power_score}', '')::int, 0) AS a_power,
      COALESCE(NULLIF(b.team_b #>> '{spider,power_score}', '')::int, 0) AS b_power,
      CASE
        WHEN b.winner = 'A' THEN (b.team_a->>'userId')::uuid
        WHEN b.winner = 'B' THEN (b.team_b->>'userId')::uuid
        ELSE NULL
      END AS winner_user,
      CASE
        WHEN b.winner = 'A' THEN (b.team_b->>'userId')::uuid
        WHEN b.winner = 'B' THEN (b.team_a->>'userId')::uuid
        ELSE NULL
      END AS loser_user,
      CASE
        WHEN b.winner = 'A' THEN COALESCE(NULLIF(b.team_a #>> '{spider,power_score}', '')::int, 0)
        WHEN b.winner = 'B' THEN COALESCE(NULLIF(b.team_b #>> '{spider,power_score}', '')::int, 0)
        ELSE 0
      END AS winner_power,
      CASE
        WHEN b.winner = 'A' THEN COALESCE(NULLIF(b.team_b #>> '{spider,power_score}', '')::int, 0)
        WHEN b.winner = 'B' THEN COALESCE(NULLIF(b.team_a #>> '{spider,power_score}', '')::int, 0)
        ELSE 0
      END AS loser_power
    FROM public.battles b
    WHERE b.league_id = get_private_league_standings.league_id
      AND b.is_active = false
      AND b.winner IN ('A', 'B')
      AND (b.team_a->>'userId') IS NOT NULL
      AND (b.team_b->>'userId') IS NOT NULL
      AND b.created_at >= v_since
  ), per_user AS (
    SELECT
      m.user_id,
      m.display_name,
      m.avatar_url,
      COALESCE(count(*) FILTER (WHERE br.winner_user = m.user_id), 0)::integer AS wins,
      COALESCE(count(*) FILTER (WHERE br.loser_user = m.user_id), 0)::integer AS losses,
      COALESCE(count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id), 0)::integer AS battles,
      CASE
        WHEN count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id) = 0 THEN 0
        ELSE round((count(*) FILTER (WHERE br.winner_user = m.user_id))::numeric / (count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id))::numeric, 3)
      END AS win_rate,
      COALESCE(SUM(
        CASE
          -- Winner only earns the upset gap (loser was stronger)
          WHEN br.winner_user = m.user_id THEN GREATEST(0, br.loser_power - br.winner_power)
          -- Loser only loses points if they were the stronger side (got upset)
          WHEN br.loser_user  = m.user_id THEN LEAST(0, br.winner_power - br.loser_power)
          ELSE 0
        END
      ), 0)::integer AS power_diff
    FROM members m
    LEFT JOIN battle_rows br ON br.a_user = m.user_id OR br.b_user = m.user_id
    GROUP BY m.user_id, m.display_name, m.avatar_url
  ), ordered_results AS (
    SELECT
      m.user_id,
      br.id AS battle_id,
      br.created_at,
      CASE
        WHEN br.winner_user = m.user_id THEN 1
        WHEN br.loser_user = m.user_id THEN -1
        ELSE 0
      END AS outcome
    FROM members m
    JOIN battle_rows br ON br.a_user = m.user_id OR br.b_user = m.user_id
  ), latest_per_user AS (
    SELECT
      orr.user_id,
      orr.outcome,
      row_number() OVER (PARTITION BY orr.user_id ORDER BY orr.created_at DESC, orr.battle_id DESC) AS rn
    FROM ordered_results orr
  ), latest_outcomes AS (
    SELECT
      lpu.user_id,
      lpu.outcome,
      lpu.rn,
      first_value(lpu.outcome) OVER (PARTITION BY lpu.user_id ORDER BY lpu.rn) AS latest_outcome
    FROM latest_per_user lpu
  ), streak_groups AS (
    SELECT
      lo.user_id,
      lo.outcome,
      lo.rn,
      lo.latest_outcome,
      SUM(CASE WHEN lo.outcome <> lo.latest_outcome THEN 1 ELSE 0 END)
        OVER (PARTITION BY lo.user_id ORDER BY lo.rn) AS break_count
    FROM latest_outcomes lo
  ), streaks AS (
    SELECT
      sg.user_id,
      (MAX(sg.latest_outcome) * count(*) FILTER (WHERE sg.break_count = 0))::integer AS streak
    FROM streak_groups sg
    GROUP BY sg.user_id
  )
  SELECT
    pu.user_id,
    pu.display_name,
    pu.avatar_url,
    pu.wins,
    pu.losses,
    pu.battles,
    pu.win_rate,
    COALESCE(s.streak, 0) AS streak,
    pu.power_diff,
    COALESCE((
      SELECT jsonb_build_object(
        'id', sp.id,
        'nickname', sp.nickname,
        'species', sp.species,
        'image_url', sp.image_url,
        'power_score', sp.power_score
      )
      FROM public.spiders sp
      WHERE sp.owner_id = pu.user_id AND sp.is_approved = true
      ORDER BY sp.power_score DESC
      LIMIT 1
    ), '{}'::jsonb) AS top_spider
  FROM per_user pu
  LEFT JOIN streaks s ON s.user_id = pu.user_id
  ORDER BY pu.power_diff DESC, pu.wins DESC, pu.win_rate DESC, pu.battles DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_private_league_standings(uuid, text) TO authenticated;
