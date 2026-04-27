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
        WHEN b.winner = 'A' THEN COALESCE(NULLIF(b.team_b #>> '{spider,power_score}', '')::int, 0) - COALESCE(NULLIF(b.team_a #>> '{spider,power_score}', '')::int, 0)
        WHEN b.winner = 'B' THEN COALESCE(NULLIF(b.team_a #>> '{spider,power_score}', '')::int, 0) - COALESCE(NULLIF(b.team_b #>> '{spider,power_score}', '')::int, 0)
        ELSE 0
      END AS winner_power_diff
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
          WHEN br.winner_user = m.user_id THEN br.winner_power_diff
          WHEN br.loser_user = m.user_id THEN -br.winner_power_diff
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
  ORDER BY pu.wins DESC, pu.win_rate DESC, pu.power_diff DESC, pu.battles DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_private_league_standings(uuid, text) TO authenticated;