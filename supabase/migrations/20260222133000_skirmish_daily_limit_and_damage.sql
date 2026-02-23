-- Enforce skirmish daily cap and increase per-turn skirmish damage.
CREATE OR REPLACE FUNCTION public.start_spider_skirmish(
  p_player_spider_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_idempotency_key text := NULLIF(trim(p_idempotency_key), '');
  v_existing public.spider_skirmishes%ROWTYPE;
  v_player public.spiders%ROWTYPE;
  v_opponent RECORD;
  v_band numeric;
  v_bands numeric[] := ARRAY[0.12, 0.15, 0.20, 0.30, 0.45];
  v_band_used numeric := NULL;
  v_power_gap_ratio numeric;
  v_stat_gap numeric;
  v_matchup_score numeric;
  v_has_opponent boolean := false;
  v_rng_seed text;
  v_turn_log jsonb := '[]'::jsonb;
  v_participants_snapshot jsonb;
  v_attacker_side text;
  v_turn int;
  v_roll_hash bigint;
  v_crit_hash bigint;
  v_roll_mod int;
  v_is_crit boolean;
  v_raw_damage int;
  v_damage int;
  v_hp_a int;
  v_hp_b int;
  v_winner_side public.battle_winner;
  v_winner_user_id uuid;
  v_winner_spider_id uuid;
  v_stat_improvements jsonb := '{}'::jsonb;
  v_xp_gain int := 12;
  v_winner_xp int;
  v_winner_level int;
  v_reward_payload jsonb;
  v_inserted public.spider_skirmishes%ROWTYPE;
  v_daily_limit int := 3;
  v_skirmishes_today int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_user::text || ':' || v_idempotency_key));

    SELECT *
    INTO v_existing
    FROM public.spider_skirmishes
    WHERE initiator_user_id = v_user
      AND idempotency_key = v_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'skirmish_id', v_existing.id,
        'created_at', v_existing.created_at,
        'matchup_score', v_existing.matchup_score,
        'player_spider', v_existing.participants_snapshot->'player_spider',
        'opponent_spider', v_existing.participants_snapshot->'opponent_spider',
        'winner_side', v_existing.winner_side,
        'winner_spider_id', v_existing.winner_spider_id,
        'turn_log', v_existing.turn_log,
        'rewards', v_existing.reward_payload,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  SELECT count(*)::int
  INTO v_skirmishes_today
  FROM public.spider_skirmishes
  WHERE initiator_user_id = v_user
    AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date;

  IF v_skirmishes_today >= v_daily_limit THEN
    RAISE EXCEPTION 'Daily skirmish limit reached (3 per day). Try again tomorrow.';
  END IF;

  IF p_player_spider_id IS NOT NULL THEN
    SELECT *
    INTO v_player
    FROM public.spiders
    WHERE id = p_player_spider_id
      AND owner_id = v_user
    LIMIT 1;
  ELSE
    SELECT *
    INTO v_player
    FROM public.spiders
    WHERE owner_id = v_user
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No approved player spider is available for skirmish';
  END IF;

  FOREACH v_band IN ARRAY v_bands LOOP
    SELECT
      s.*,
      COALESCE(p.display_name, 'Spider Trainer') AS owner_display_name
    INTO v_opponent
    FROM public.spiders s
    LEFT JOIN public.profiles p ON p.id = s.owner_id
    WHERE s.is_approved = true
      AND s.owner_id <> v_user
      AND s.power_score BETWEEN floor(v_player.power_score * (1 - v_band))::int
                            AND ceil(v_player.power_score * (1 + v_band))::int
      AND NOT EXISTS (
        SELECT 1
        FROM public.spider_skirmishes sk
        WHERE sk.created_at > now() - interval '6 hours'
          AND (
            (sk.initiator_user_id = v_user
             AND sk.initiator_spider_id = v_player.id
             AND sk.opponent_spider_id = s.id)
            OR
            (sk.opponent_user_id = v_user
             AND sk.opponent_spider_id = v_player.id
             AND sk.initiator_spider_id = s.id)
          )
      )
    ORDER BY
      abs(s.power_score - v_player.power_score) ASC,
      (
        abs(s.damage - v_player.damage) +
        abs(s.webcraft - v_player.webcraft) +
        abs(s.defense - v_player.defense) +
        abs(s.speed - v_player.speed) +
        abs(s.venom - v_player.venom)
      ) ASC,
      s.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_band_used := v_band;
      v_has_opponent := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_has_opponent THEN
    -- Final fallback: allow any approved opponent spider if strict filters return none.
    SELECT
      s.*,
      COALESCE(p.display_name, 'Spider Trainer') AS owner_display_name
    INTO v_opponent
    FROM public.spiders s
    LEFT JOIN public.profiles p ON p.id = s.owner_id
    WHERE s.is_approved = true
      AND s.owner_id <> v_user
      AND NOT EXISTS (
        SELECT 1
        FROM public.spider_skirmishes sk
        WHERE sk.created_at > now() - interval '6 hours'
          AND (
            (sk.initiator_user_id = v_user
             AND sk.initiator_spider_id = v_player.id
             AND sk.opponent_spider_id = s.id)
            OR
            (sk.opponent_user_id = v_user
             AND sk.opponent_spider_id = v_player.id
             AND sk.initiator_spider_id = s.id)
          )
      )
    ORDER BY
      abs(s.power_score - v_player.power_score) ASC,
      (
        abs(s.damage - v_player.damage) +
        abs(s.webcraft - v_player.webcraft) +
        abs(s.defense - v_player.defense) +
        abs(s.speed - v_player.speed) +
        abs(s.venom - v_player.venom)
      ) ASC,
      s.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_has_opponent := true;
    ELSE
      SELECT
        s.*,
        COALESCE(p.display_name, 'Spider Trainer') AS owner_display_name
      INTO v_opponent
      FROM public.spiders s
      LEFT JOIN public.profiles p ON p.id = s.owner_id
      WHERE s.owner_id <> v_user
      ORDER BY
        abs(s.power_score - v_player.power_score) ASC,
        (
          abs(s.damage - v_player.damage) +
          abs(s.webcraft - v_player.webcraft) +
          abs(s.defense - v_player.defense) +
          abs(s.speed - v_player.speed) +
          abs(s.venom - v_player.venom)
        ) ASC,
        s.created_at DESC
      LIMIT 1;

      IF FOUND THEN
        v_has_opponent := true;
      END IF;
    END IF;
  END IF;

  IF NOT v_has_opponent THEN
    RAISE EXCEPTION 'No eligible opponent spider found right now';
  END IF;

  v_power_gap_ratio := abs(v_player.power_score - v_opponent.power_score)::numeric / GREATEST(v_player.power_score, 1);
  v_stat_gap := (
    abs(v_player.damage - v_opponent.damage) +
    abs(v_player.webcraft - v_opponent.webcraft) +
    abs(v_player.defense - v_opponent.defense) +
    abs(v_player.speed - v_opponent.speed) +
    abs(v_player.venom - v_opponent.venom)
  )::numeric / 5.0;
  v_matchup_score := GREATEST(1, ROUND(100 - (v_power_gap_ratio * 100) - (v_stat_gap * 0.4), 2));

  v_participants_snapshot := jsonb_build_object(
    'player_spider', jsonb_build_object(
      'id', v_player.id,
      'owner_id', v_player.owner_id,
      'nickname', v_player.nickname,
      'species', v_player.species,
      'image_url', v_player.image_url,
      'power_score', v_player.power_score,
      'hit_points', v_player.hit_points,
      'damage', v_player.damage,
      'speed', v_player.speed,
      'defense', v_player.defense,
      'venom', v_player.venom,
      'webcraft', v_player.webcraft
    ),
    'opponent_spider', jsonb_build_object(
      'id', v_opponent.id,
      'owner_id', v_opponent.owner_id,
      'owner_display_name', v_opponent.owner_display_name,
      'nickname', v_opponent.nickname,
      'species', v_opponent.species,
      'image_url', v_opponent.image_url,
      'power_score', v_opponent.power_score,
      'hit_points', v_opponent.hit_points,
      'damage', v_opponent.damage,
      'speed', v_opponent.speed,
      'defense', v_opponent.defense,
      'venom', v_opponent.venom,
      'webcraft', v_opponent.webcraft
    )
  );

  v_rng_seed := encode(gen_random_bytes(12), 'hex');
  v_hp_a := v_player.hit_points;
  v_hp_b := v_opponent.hit_points;

  IF v_player.speed = v_opponent.speed THEN
    v_roll_hash := abs((('x' || substr(md5(v_rng_seed || ':first'), 1, 8))::bit(32)::int)::bigint);
    v_attacker_side := CASE WHEN (v_roll_hash % 2) = 0 THEN 'A' ELSE 'B' END;
  ELSIF v_player.speed > v_opponent.speed THEN
    v_attacker_side := 'A';
  ELSE
    v_attacker_side := 'B';
  END IF;

  FOR v_turn IN 1..25 LOOP
    EXIT WHEN v_hp_a <= 0 OR v_hp_b <= 0;

    v_roll_hash := abs((('x' || substr(md5(v_rng_seed || ':' || v_turn::text || ':' || v_attacker_side || ':roll'), 1, 8))::bit(32)::int)::bigint);
    v_crit_hash := abs((('x' || substr(md5(v_rng_seed || ':' || v_turn::text || ':' || v_attacker_side || ':crit'), 1, 8))::bit(32)::int)::bigint);
    v_roll_mod := ((v_roll_hash % 7)::int - 3);
    v_is_crit := (v_crit_hash % 100) < 8;

    IF v_attacker_side = 'A' THEN
      v_raw_damage := round(
        (v_player.damage * 0.65 + v_player.venom * 0.30 + v_player.speed * 0.25)
        - (v_opponent.defense * 0.28 + v_opponent.webcraft * 0.14)
      )::int;
      v_damage := GREATEST(2, v_raw_damage + v_roll_mod + CASE WHEN v_is_crit THEN 3 ELSE 0 END);
      v_hp_b := GREATEST(0, v_hp_b - v_damage);

      v_turn_log := v_turn_log || jsonb_build_array(
        jsonb_build_object(
          'turn', v_turn,
          'attacker_side', 'A',
          'attacker_id', v_player.id,
          'defender_id', v_opponent.id,
          'damage', v_damage,
          'attacker_hp', v_hp_a,
          'defender_hp', v_hp_b,
          'crit', v_is_crit
        )
      );
    ELSE
      v_raw_damage := round(
        (v_opponent.damage * 0.65 + v_opponent.venom * 0.30 + v_opponent.speed * 0.25)
        - (v_player.defense * 0.28 + v_player.webcraft * 0.14)
      )::int;
      v_damage := GREATEST(2, v_raw_damage + v_roll_mod + CASE WHEN v_is_crit THEN 3 ELSE 0 END);
      v_hp_a := GREATEST(0, v_hp_a - v_damage);

      v_turn_log := v_turn_log || jsonb_build_array(
        jsonb_build_object(
          'turn', v_turn,
          'attacker_side', 'B',
          'attacker_id', v_opponent.id,
          'defender_id', v_player.id,
          'damage', v_damage,
          'attacker_hp', v_hp_b,
          'defender_hp', v_hp_a,
          'crit', v_is_crit
        )
      );
    END IF;

    v_attacker_side := CASE WHEN v_attacker_side = 'A' THEN 'B' ELSE 'A' END;
  END LOOP;

  IF v_hp_a = v_hp_b THEN
    IF v_player.power_score >= v_opponent.power_score THEN
      v_winner_side := 'A'::public.battle_winner;
    ELSE
      v_winner_side := 'B'::public.battle_winner;
    END IF;
  ELSIF v_hp_a > v_hp_b THEN
    v_winner_side := 'A'::public.battle_winner;
  ELSE
    v_winner_side := 'B'::public.battle_winner;
  END IF;

  IF v_winner_side = 'A' THEN
    v_winner_user_id := v_player.owner_id;
    v_winner_spider_id := v_player.id;
  ELSE
    v_winner_user_id := v_opponent.owner_id;
    v_winner_spider_id := v_opponent.id;
  END IF;

  v_stat_improvements := public.improve_spider_for_skirmish(v_winner_spider_id);
  PERFORM public.ensure_user_progression(v_winner_user_id);

  UPDATE public.user_progression
  SET experience_points = experience_points + v_xp_gain,
      level = ((experience_points + v_xp_gain) / 100) + 1,
      updated_at = now()
  WHERE user_id = v_winner_user_id
  RETURNING experience_points, level
  INTO v_winner_xp, v_winner_level;

  v_reward_payload := jsonb_build_object(
    'winner_user_id', v_winner_user_id,
    'winner_spider_id', v_winner_spider_id,
    'winner_xp_gain', v_xp_gain,
    'winner_new_xp', v_winner_xp,
    'winner_new_level', v_winner_level,
    'xp_gain', CASE WHEN v_winner_user_id = v_user THEN v_xp_gain ELSE 0 END,
    'new_xp', CASE WHEN v_winner_user_id = v_user THEN v_winner_xp ELSE NULL END,
    'new_level', CASE WHEN v_winner_user_id = v_user THEN v_winner_level ELSE NULL END,
    'stat_improvements', COALESCE(v_stat_improvements, '{}'::jsonb),
    'daily_limit', v_daily_limit,
    'skirmishes_used_today', v_skirmishes_today + 1,
    'skirmishes_remaining_today', GREATEST(v_daily_limit - (v_skirmishes_today + 1), 0)
  );

  INSERT INTO public.spider_skirmishes (
    initiator_user_id,
    initiator_spider_id,
    opponent_user_id,
    opponent_spider_id,
    winner_user_id,
    winner_spider_id,
    winner_side,
    status,
    rng_seed,
    matchup_score,
    turn_log,
    participants_snapshot,
    reward_payload,
    idempotency_key,
    resolved_at
  ) VALUES (
    v_user,
    v_player.id,
    v_opponent.owner_id,
    v_opponent.id,
    v_winner_user_id,
    v_winner_spider_id,
    v_winner_side,
    'COMPLETED',
    v_rng_seed,
    v_matchup_score,
    v_turn_log,
    v_participants_snapshot,
    v_reward_payload,
    v_idempotency_key,
    now()
  )
  RETURNING *
  INTO v_inserted;

  RETURN jsonb_build_object(
    'skirmish_id', v_inserted.id,
    'created_at', v_inserted.created_at,
    'matchup_score', v_inserted.matchup_score,
    'player_spider', v_participants_snapshot->'player_spider',
    'opponent_spider', v_participants_snapshot->'opponent_spider',
    'winner_side', v_winner_side,
    'winner_spider_id', v_winner_spider_id,
    'turn_log', v_turn_log,
    'rewards', v_reward_payload,
    'idempotent_replay', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_spider_skirmish(uuid, text) TO authenticated;
