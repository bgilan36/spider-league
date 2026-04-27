DROP FUNCTION IF EXISTS public.get_private_league_standings(uuid);
DROP FUNCTION IF EXISTS public.get_private_league_standings(uuid, text);

CREATE OR REPLACE FUNCTION public.get_private_league_standings(
  league_id uuid,
  timeframe text DEFAULT 'weekly'
)
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
  IF v_user_id IS NULL OR NOT public.is_private_league_member(league_id, v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF timeframe = 'weekly' THEN
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
      END AS loser_user
    FROM public.battles b
    WHERE b.league_id = get_private_league_standings.league_id
      AND b.is_active = false
      AND b.winner IN ('A', 'B')
      AND b.created_at >= v_since
  ), per_user AS (
    SELECT
      m.user_id,
      m.display_name,
      m.avatar_url,
      COALESCE(count(*) FILTER (WHERE br.winner_user = m.user_id), 0)::integer AS wins,
      COALESCE(count(*) FILTER (WHERE br.loser_user = m.user_id), 0)::integer AS losses,
      COALESCE(count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id), 0)::integer AS battles,
      CASE WHEN count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id) = 0 THEN 0
        ELSE round((count(*) FILTER (WHERE br.winner_user = m.user_id))::numeric * 100 / (count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id))::numeric, 1)
      END AS win_rate,
      COALESCE(SUM(
        CASE
          WHEN br.a_user = m.user_id THEN (br.a_power - br.b_power)
          WHEN br.b_user = m.user_id THEN (br.b_power - br.a_power)
          ELSE 0
        END
      ), 0)::integer AS power_diff
    FROM members m
    LEFT JOIN battle_rows br ON br.a_user = m.user_id OR br.b_user = m.user_id
    GROUP BY m.user_id, m.display_name, m.avatar_url
  ), ordered_results AS (
    SELECT
      m.user_id,
      br.created_at,
      CASE
        WHEN br.winner_user = m.user_id THEN 1
        WHEN br.loser_user = m.user_id THEN -1
        ELSE 0
      END AS outcome
    FROM members m
    JOIN battle_rows br ON (br.a_user = m.user_id OR br.b_user = m.user_id)
  ), latest_per_user AS (
    SELECT
      ordered_results.user_id,
      ordered_results.outcome,
      row_number() OVER (PARTITION BY ordered_results.user_id ORDER BY ordered_results.created_at DESC) AS rn
    FROM ordered_results
  ), streak_groups AS (
    SELECT
      lpu.user_id,
      lpu.outcome,
      lpu.rn,
      first_value(lpu.outcome) OVER (PARTITION BY lpu.user_id ORDER BY lpu.rn) AS latest_outcome,
      SUM(
        CASE
          WHEN lpu.outcome <> first_value(lpu.outcome) OVER (PARTITION BY lpu.user_id ORDER BY lpu.rn)
          THEN 1
          ELSE 0
        END
      ) OVER (PARTITION BY lpu.user_id ORDER BY lpu.rn) AS break_count
    FROM latest_per_user lpu
  ), streaks AS (
    SELECT
      sg.user_id,
      CASE
        WHEN MAX(sg.latest_outcome) = 0 THEN 0
        ELSE MAX(sg.latest_outcome) * count(*) FILTER (WHERE sg.break_count = 0)::integer
      END AS streak
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
      SELECT jsonb_build_object('id', sp.id, 'nickname', sp.nickname, 'species', sp.species, 'image_url', sp.image_url, 'power_score', sp.power_score)
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