
-- Update start_spider_skirmish to award spider XP to both winner and loser
CREATE OR REPLACE FUNCTION public.start_spider_skirmish(p_player_spider_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_today_count int;
  v_daily_limit int := 3;
  v_player_spider RECORD;
  v_opponent RECORD;
  v_existing jsonb;
  v_seed text;
  v_turn_log jsonb := '[]'::jsonb;
  v_player_hp int;
  v_opponent_hp int;
  v_attacker_side text;
  v_turn int;
  v_raw_damage int;
  v_damage int;
  v_roll_mod int;
  v_is_crit boolean;
  v_hash bigint;
  v_winner_side text;
  v_winner_spider_id uuid;
  v_player_won boolean;
  v_xp_gain int;
  v_stat_improvements jsonb := '{}'::jsonb;
  v_stat_name text;
  v_stat_val int;
  v_new_val int;
  v_bump int;
  v_matchup_score numeric;
  v_power_gap numeric;
  v_skirmish_id uuid;
  v_player_snapshot jsonb;
  v_opponent_snapshot jsonb;
  v_stats text[] := ARRAY['hit_points','damage','speed','defense','venom','webcraft'];
  v_num_boosts int;
  v_recent_opponent_ids uuid[];
  v_winner_xp_result jsonb;
  v_loser_xp_result jsonb;
  v_loser_spider_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_today_start := date_trunc('day', now() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles';
  v_today_end := v_today_start + interval '1 day';

  IF p_idempotency_key IS NOT NULL THEN
    SELECT jsonb_build_object(
      'skirmish_id', s.id,
      'created_at', s.created_at,
      'matchup_score', s.matchup_score,
      'player_spider', s.player_spider_snapshot,
      'opponent_spider', s.opponent_spider_snapshot,
      'winner_side', s.winner_side,
      'winner_spider_id', s.winner_spider_id,
      'turn_log', s.turn_log,
      'rewards', s.rewards,
      'idempotent_replay', true
    ) INTO v_existing
    FROM public.spider_skirmishes s
    WHERE s.initiator_user_id = v_user_id
      AND s.idempotency_key = p_idempotency_key;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  ELSE
    p_idempotency_key := gen_random_uuid()::text;
  END IF;

  SELECT count(*) INTO v_today_count
  FROM public.spider_skirmishes
  WHERE initiator_user_id = v_user_id
    AND created_at >= v_today_start
    AND created_at < v_today_end;

  IF v_today_count >= v_daily_limit THEN
    RAISE EXCEPTION 'Daily skirmish limit reached (% per day). Try again tomorrow.', v_daily_limit;
  END IF;

  IF p_player_spider_id IS NOT NULL THEN
    SELECT * INTO v_player_spider
    FROM public.spiders
    WHERE id = p_player_spider_id AND owner_id = v_user_id;
  END IF;
  IF v_player_spider IS NULL THEN
    SELECT * INTO v_player_spider
    FROM public.spiders
    WHERE owner_id = v_user_id
    ORDER BY power_score DESC
    LIMIT 1;
  END IF;
  IF v_player_spider IS NULL THEN
    RAISE EXCEPTION 'No spiders found in your collection.';
  END IF;

  SELECT array_agg(opponent_spider_id) INTO v_recent_opponent_ids
  FROM (
    SELECT opponent_spider_id FROM public.spider_skirmishes
    WHERE initiator_user_id = v_user_id
    ORDER BY created_at DESC LIMIT 3
  ) sub;
  IF v_recent_opponent_ids IS NULL THEN v_recent_opponent_ids := ARRAY[]::uuid[]; END IF;

  v_opponent := NULL;
  FOR v_band IN 1..5 LOOP
    DECLARE
      v_pct numeric;
    BEGIN
      v_pct := CASE v_band
        WHEN 1 THEN 0.12
        WHEN 2 THEN 0.20
        WHEN 3 THEN 0.35
        WHEN 4 THEN 0.55
        ELSE 1.0
      END;

      SELECT * INTO v_opponent
      FROM public.spiders
      WHERE is_approved = true
        AND owner_id != v_user_id
        AND id != ALL(v_recent_opponent_ids)
        AND power_score BETWEEN
          floor(v_player_spider.power_score * (1.0 - v_pct))::int
          AND ceil(v_player_spider.power_score * (1.0 + v_pct))::int
      ORDER BY abs(power_score - v_player_spider.power_score), random()
      LIMIT 1;

      IF v_opponent IS NOT NULL THEN EXIT; END IF;
    END;
  END LOOP;

  IF v_opponent IS NULL THEN
    SELECT * INTO v_opponent
    FROM public.spiders
    WHERE is_approved = true
      AND owner_id != v_user_id
    ORDER BY abs(power_score - v_player_spider.power_score), random()
    LIMIT 1;
  END IF;

  IF v_opponent IS NULL THEN
    RAISE EXCEPTION 'No opponent spiders available right now.';
  END IF;

  v_power_gap := abs(v_player_spider.power_score - v_opponent.power_score)::numeric
    / GREATEST(1, v_player_spider.power_score);
  v_matchup_score := GREATEST(1, round(100 - v_power_gap * 100, 2));

  v_player_snapshot := jsonb_build_object(
    'id', v_player_spider.id, 'owner_id', v_player_spider.owner_id,
    'nickname', v_player_spider.nickname, 'species', v_player_spider.species,
    'image_url', v_player_spider.image_url, 'power_score', v_player_spider.power_score,
    'hit_points', v_player_spider.hit_points, 'damage', v_player_spider.damage,
    'speed', v_player_spider.speed, 'defense', v_player_spider.defense,
    'venom', v_player_spider.venom, 'webcraft', v_player_spider.webcraft,
    'level', v_player_spider.level, 'xp', v_player_spider.xp
  );
  v_opponent_snapshot := jsonb_build_object(
    'id', v_opponent.id, 'owner_id', v_opponent.owner_id,
    'nickname', v_opponent.nickname, 'species', v_opponent.species,
    'image_url', v_opponent.image_url, 'power_score', v_opponent.power_score,
    'hit_points', v_opponent.hit_points, 'damage', v_opponent.damage,
    'speed', v_opponent.speed, 'defense', v_opponent.defense,
    'venom', v_opponent.venom, 'webcraft', v_opponent.webcraft,
    'level', v_opponent.level, 'xp', v_opponent.xp
  );

  v_seed := encode(gen_random_bytes(16), 'hex');

  v_player_hp := v_player_spider.hit_points;
  v_opponent_hp := v_opponent.hit_points;

  IF v_player_spider.speed > v_opponent.speed THEN
    v_attacker_side := 'A';
  ELSIF v_opponent.speed > v_player_spider.speed THEN
    v_attacker_side := 'B';
  ELSE
    v_hash := abs(hashtext(v_seed || ':first'));
    v_attacker_side := CASE WHEN v_hash % 2 = 0 THEN 'A' ELSE 'B' END;
  END IF;

  FOR v_turn IN 1..25 LOOP
    EXIT WHEN v_player_hp <= 0 OR v_opponent_hp <= 0;

    v_hash := abs(hashtext(v_seed || ':' || v_turn || ':roll'));
    v_roll_mod := (v_hash % 7) - 3;
    v_is_crit := (abs(hashtext(v_seed || ':' || v_turn || ':crit')) % 100) < 8;

    IF v_attacker_side = 'A' THEN
      v_raw_damage := round(
        v_player_spider.damage * 0.65
        + v_player_spider.venom * 0.30
        + v_player_spider.speed * 0.25
        - v_opponent.defense * 0.28
        - v_opponent.webcraft * 0.14
      );
      v_damage := GREATEST(2, v_raw_damage + v_roll_mod + CASE WHEN v_is_crit THEN 3 ELSE 0 END);
      v_opponent_hp := GREATEST(0, v_opponent_hp - v_damage);

      v_turn_log := v_turn_log || jsonb_build_object(
        'turn', v_turn, 'attacker_side', 'A',
        'attacker_id', v_player_spider.id, 'defender_id', v_opponent.id,
        'damage', v_damage, 'attacker_hp', v_player_hp,
        'defender_hp', v_opponent_hp, 'crit', v_is_crit
      );
    ELSE
      v_raw_damage := round(
        v_opponent.damage * 0.65
        + v_opponent.venom * 0.30
        + v_opponent.speed * 0.25
        - v_player_spider.defense * 0.28
        - v_player_spider.webcraft * 0.14
      );
      v_damage := GREATEST(2, v_raw_damage + v_roll_mod + CASE WHEN v_is_crit THEN 3 ELSE 0 END);
      v_player_hp := GREATEST(0, v_player_hp - v_damage);

      v_turn_log := v_turn_log || jsonb_build_object(
        'turn', v_turn, 'attacker_side', 'B',
        'attacker_id', v_opponent.id, 'defender_id', v_player_spider.id,
        'damage', v_damage, 'attacker_hp', v_opponent_hp,
        'defender_hp', v_player_hp, 'crit', v_is_crit
      );
    END IF;

    v_attacker_side := CASE WHEN v_attacker_side = 'A' THEN 'B' ELSE 'A' END;
  END LOOP;

  IF v_player_hp = v_opponent_hp THEN
    v_winner_side := CASE WHEN v_player_spider.power_score >= v_opponent.power_score THEN 'A' ELSE 'B' END;
  ELSE
    v_winner_side := CASE WHEN v_player_hp > v_opponent_hp THEN 'A' ELSE 'B' END;
  END IF;

  v_player_won := (v_winner_side = 'A');
  v_winner_spider_id := CASE WHEN v_player_won THEN v_player_spider.id ELSE v_opponent.id END;
  v_loser_spider_id := CASE WHEN v_player_won THEN v_opponent.id ELSE v_player_spider.id END;

  -- Rewards (user XP only if player won, same as before)
  v_xp_gain := 0;
  IF v_player_won THEN
    v_xp_gain := 12;
    UPDATE public.profiles SET xp = xp + v_xp_gain WHERE id = v_user_id;

    v_hash := abs(hashtext(v_seed || ':num_boosts'));
    v_num_boosts := 1 + (v_hash % 3);

    FOR i IN 1..v_num_boosts LOOP
      v_hash := abs(hashtext(v_seed || ':stat:' || i));
      v_stat_name := v_stats[1 + (v_hash % 6)];
      v_bump := 1 + (abs(hashtext(v_seed || ':bump:' || i)) % 2);

      EXECUTE format('SELECT %I FROM spiders WHERE id = $1', v_stat_name)
        INTO v_stat_val USING v_player_spider.id;

      v_new_val := LEAST(100, v_stat_val + v_bump);
      v_bump := v_new_val - v_stat_val;

      IF v_bump > 0 THEN
        EXECUTE format('UPDATE spiders SET %I = $1, power_score = power_score + $2, updated_at = now() WHERE id = $3', v_stat_name)
          USING v_new_val, v_bump, v_player_spider.id;
        v_stat_improvements := v_stat_improvements || jsonb_build_object(v_stat_name, v_bump);
      END IF;
    END LOOP;
  END IF;

  -- Award spider XP: winner gets 15, loser gets 5
  v_winner_xp_result := public.award_spider_xp(v_winner_spider_id, 15, v_seed);
  v_loser_xp_result := public.award_spider_xp(v_loser_spider_id, 5, v_seed);

  INSERT INTO public.spider_skirmishes (
    initiator_user_id, player_spider_id, opponent_spider_id,
    winner_side, winner_spider_id, matchup_score, rng_seed,
    turn_log, rewards, idempotency_key,
    player_spider_snapshot, opponent_spider_snapshot
  ) VALUES (
    v_user_id, v_player_spider.id, v_opponent.id,
    v_winner_side, v_winner_spider_id, v_matchup_score, v_seed,
    v_turn_log,
    jsonb_build_object(
      'xp_gain', v_xp_gain,
      'new_xp', (SELECT xp FROM public.profiles WHERE id = v_user_id),
      'stat_improvements', v_stat_improvements,
      'spider_xp', jsonb_build_object(
        'winner', v_winner_xp_result,
        'loser', v_loser_xp_result
      )
    ),
    p_idempotency_key,
    v_player_snapshot, v_opponent_snapshot
  ) RETURNING id INTO v_skirmish_id;

  RETURN jsonb_build_object(
    'skirmish_id', v_skirmish_id,
    'created_at', now(),
    'matchup_score', v_matchup_score,
    'player_spider', v_player_snapshot,
    'opponent_spider', v_opponent_snapshot,
    'winner_side', v_winner_side,
    'winner_spider_id', v_winner_spider_id,
    'turn_log', v_turn_log,
    'rewards', jsonb_build_object(
      'xp_gain', v_xp_gain,
      'new_xp', (SELECT xp FROM public.profiles WHERE id = v_user_id),
      'stat_improvements', v_stat_improvements,
      'spider_xp', jsonb_build_object(
        'winner', v_winner_xp_result,
        'loser', v_loser_xp_result
      )
    ),
    'idempotent_replay', false
  );
END;
$function$;

-- Update resolve_battle_challenge to award spider XP
CREATE OR REPLACE FUNCTION public.resolve_battle_challenge(challenge_id uuid, winner_user_id uuid, loser_user_id uuid, battle_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  challenge_record RECORD;
  loser_spider UUID;
  winner_spider UUID;
  stat_improvements JSONB;
  v_battle_xp int := 25;
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

  IF winner_user_id = challenge_record.challenger_id THEN
    loser_spider := challenge_record.accepter_spider_id;
    winner_spider := challenge_record.challenger_spider_id;
  ELSE
    loser_spider := challenge_record.challenger_spider_id;
    winner_spider := challenge_record.accepter_spider_id;
  END IF;

  -- Generate a seed for level-up stat boosts
  v_seed := encode(gen_random_bytes(8), 'hex');

  -- Improve winning spider stats (existing behavior)
  stat_improvements := public.improve_spider_after_victory(winner_spider);

  -- Transfer spider ownership
  PERFORM public.transfer_spider_ownership(loser_spider, winner_user_id);

  -- Award XP to battle winner (user XP)
  UPDATE public.profiles SET xp = xp + v_battle_xp WHERE id = winner_user_id;

  -- Award spider XP: winner gets 30, loser gets 10
  v_winner_xp_result := public.award_spider_xp(winner_spider, 30, v_seed);
  v_loser_xp_result := public.award_spider_xp(loser_spider, 10, v_seed);

  -- Update challenge status
  UPDATE public.battle_challenges
  SET status = 'COMPLETED',
      battle_id = battle_id_param,
      winner_id = winner_user_id,
      loser_spider_id = loser_spider
  WHERE id = challenge_id;

  RETURN stat_improvements || jsonb_build_object(
    'battle_xp_awarded', v_battle_xp,
    'spider_xp', jsonb_build_object(
      'winner', v_winner_xp_result,
      'loser', v_loser_xp_result
    )
  );
END;
$function$;
