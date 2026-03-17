
-- 1. Add XP column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;

-- 2. Create spider_skirmishes table
CREATE TABLE public.spider_skirmishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_user_id uuid NOT NULL,
  player_spider_id uuid NOT NULL REFERENCES public.spiders(id),
  opponent_spider_id uuid NOT NULL REFERENCES public.spiders(id),
  winner_side text NOT NULL CHECK (winner_side IN ('A','B')),
  winner_spider_id uuid NOT NULL REFERENCES public.spiders(id),
  matchup_score numeric NOT NULL DEFAULT 50,
  rng_seed text NOT NULL,
  turn_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  rewards jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  player_spider_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  opponent_spider_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_skirmishes_idempotency ON public.spider_skirmishes (initiator_user_id, idempotency_key);
CREATE INDEX idx_skirmishes_user_day ON public.spider_skirmishes (initiator_user_id, created_at);

ALTER TABLE public.spider_skirmishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own skirmishes"
  ON public.spider_skirmishes FOR SELECT
  TO authenticated
  USING (auth.uid() = initiator_user_id);

CREATE POLICY "No direct inserts"
  ON public.spider_skirmishes FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No updates"
  ON public.spider_skirmishes FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No deletes"
  ON public.spider_skirmishes FOR DELETE
  TO authenticated
  USING (false);

-- 3. Server-side skirmish RPC
CREATE OR REPLACE FUNCTION public.start_spider_skirmish(
  p_player_spider_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Day bounds (UTC)
  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_today_end := v_today_start + interval '1 day';

  -- Idempotency check
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

  -- Daily limit
  SELECT count(*) INTO v_today_count
  FROM public.spider_skirmishes
  WHERE initiator_user_id = v_user_id
    AND created_at >= v_today_start
    AND created_at < v_today_end;

  IF v_today_count >= v_daily_limit THEN
    RAISE EXCEPTION 'Daily skirmish limit reached (% per day). Try again tomorrow.', v_daily_limit;
  END IF;

  -- Pick player spider
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

  -- Cooldown: get last 3 opponent spider ids
  SELECT array_agg(opponent_spider_id) INTO v_recent_opponent_ids
  FROM (
    SELECT opponent_spider_id FROM public.spider_skirmishes
    WHERE initiator_user_id = v_user_id
    ORDER BY created_at DESC LIMIT 3
  ) sub;
  IF v_recent_opponent_ids IS NULL THEN v_recent_opponent_ids := ARRAY[]::uuid[]; END IF;

  -- Matchmaking: try progressively wider bands
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

  -- Last resort: skip cooldown
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

  -- Matchup score
  v_power_gap := abs(v_player_spider.power_score - v_opponent.power_score)::numeric
    / GREATEST(1, v_player_spider.power_score);
  v_matchup_score := GREATEST(1, round(100 - v_power_gap * 100, 2));

  -- Snapshots
  v_player_snapshot := jsonb_build_object(
    'id', v_player_spider.id, 'owner_id', v_player_spider.owner_id,
    'nickname', v_player_spider.nickname, 'species', v_player_spider.species,
    'image_url', v_player_spider.image_url, 'power_score', v_player_spider.power_score,
    'hit_points', v_player_spider.hit_points, 'damage', v_player_spider.damage,
    'speed', v_player_spider.speed, 'defense', v_player_spider.defense,
    'venom', v_player_spider.venom, 'webcraft', v_player_spider.webcraft
  );
  v_opponent_snapshot := jsonb_build_object(
    'id', v_opponent.id, 'owner_id', v_opponent.owner_id,
    'nickname', v_opponent.nickname, 'species', v_opponent.species,
    'image_url', v_opponent.image_url, 'power_score', v_opponent.power_score,
    'hit_points', v_opponent.hit_points, 'damage', v_opponent.damage,
    'speed', v_opponent.speed, 'defense', v_opponent.defense,
    'venom', v_opponent.venom, 'webcraft', v_opponent.webcraft
  );

  -- Generate seed
  v_seed := encode(gen_random_bytes(16), 'hex');

  -- Simulate battle
  v_player_hp := v_player_spider.hit_points;
  v_opponent_hp := v_opponent.hit_points;

  IF v_player_spider.speed > v_opponent.speed THEN
    v_attacker_side := 'A';
  ELSIF v_opponent.speed > v_player_spider.speed THEN
    v_attacker_side := 'B';
  ELSE
    -- Use seed to decide
    v_hash := abs(hashtext(v_seed || ':first'));
    v_attacker_side := CASE WHEN v_hash % 2 = 0 THEN 'A' ELSE 'B' END;
  END IF;

  FOR v_turn IN 1..25 LOOP
    EXIT WHEN v_player_hp <= 0 OR v_opponent_hp <= 0;

    v_hash := abs(hashtext(v_seed || ':' || v_turn || ':roll'));
    v_roll_mod := (v_hash % 7) - 3;
    v_is_crit := (abs(hashtext(v_seed || ':' || v_turn || ':crit')) % 100) < 8;

    IF v_attacker_side = 'A' THEN
      -- Stronger damage formula: 0.65*dmg + 0.30*venom + 0.25*speed - 0.28*def - 0.14*web
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

  -- Determine winner
  IF v_player_hp = v_opponent_hp THEN
    v_winner_side := CASE WHEN v_player_spider.power_score >= v_opponent.power_score THEN 'A' ELSE 'B' END;
  ELSE
    v_winner_side := CASE WHEN v_player_hp > v_opponent_hp THEN 'A' ELSE 'B' END;
  END IF;

  v_player_won := (v_winner_side = 'A');
  v_winner_spider_id := CASE WHEN v_player_won THEN v_player_spider.id ELSE v_opponent.id END;

  -- Rewards (only if player won)
  v_xp_gain := 0;
  IF v_player_won THEN
    v_xp_gain := 12;
    -- XP to user
    UPDATE public.profiles SET xp = xp + v_xp_gain WHERE id = v_user_id;

    -- Modest stat buff: 1-3 random stats, +1-2 each, cap 100
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

  -- Persist skirmish record (SECURITY DEFINER bypasses restrictive INSERT policy)
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
      'stat_improvements', v_stat_improvements
    ),
    p_idempotency_key,
    v_player_snapshot, v_opponent_snapshot
  ) RETURNING id INTO v_skirmish_id;

  -- Return result
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
      'stat_improvements', v_stat_improvements
    ),
    'idempotent_replay', false
  );
END;
$fn$;

-- 4. Suggestion RPC
CREATE OR REPLACE FUNCTION public.get_spider_skirmish_suggestion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_user_id uuid;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_today_count int;
  v_daily_limit int := 3;
  v_player_spider RECORD;
  v_opponent RECORD;
  v_matchup_score numeric;
  v_power_gap numeric;
  v_recent_opponent_ids uuid[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'Not authenticated');
  END IF;

  v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_today_end := v_today_start + interval '1 day';

  SELECT count(*) INTO v_today_count
  FROM public.spider_skirmishes
  WHERE initiator_user_id = v_user_id
    AND created_at >= v_today_start AND created_at < v_today_end;

  IF v_today_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', format('Daily skirmish limit reached (%s per day). Try again tomorrow.', v_daily_limit),
      'daily_limit', v_daily_limit,
      'skirmishes_used_today', v_today_count,
      'skirmishes_remaining_today', 0
    );
  END IF;

  SELECT * INTO v_player_spider FROM public.spiders
  WHERE owner_id = v_user_id ORDER BY power_score DESC LIMIT 1;

  IF v_player_spider IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'No spiders found in your collection.');
  END IF;

  SELECT array_agg(opponent_spider_id) INTO v_recent_opponent_ids
  FROM (SELECT opponent_spider_id FROM public.spider_skirmishes
        WHERE initiator_user_id = v_user_id ORDER BY created_at DESC LIMIT 3) sub;
  IF v_recent_opponent_ids IS NULL THEN v_recent_opponent_ids := ARRAY[]::uuid[]; END IF;

  FOR v_band IN 1..5 LOOP
    DECLARE v_pct numeric;
    BEGIN
      v_pct := CASE v_band WHEN 1 THEN 0.12 WHEN 2 THEN 0.20 WHEN 3 THEN 0.35 WHEN 4 THEN 0.55 ELSE 1.0 END;
      SELECT * INTO v_opponent FROM public.spiders
      WHERE is_approved = true AND owner_id != v_user_id
        AND id != ALL(v_recent_opponent_ids)
        AND power_score BETWEEN floor(v_player_spider.power_score*(1.0-v_pct))::int AND ceil(v_player_spider.power_score*(1.0+v_pct))::int
      ORDER BY abs(power_score - v_player_spider.power_score), random() LIMIT 1;
      IF v_opponent IS NOT NULL THEN EXIT; END IF;
    END;
  END LOOP;

  IF v_opponent IS NULL THEN
    SELECT * INTO v_opponent FROM public.spiders
    WHERE is_approved = true AND owner_id != v_user_id
    ORDER BY abs(power_score - v_player_spider.power_score), random() LIMIT 1;
  END IF;

  IF v_opponent IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'No opponent spiders available right now.');
  END IF;

  v_power_gap := abs(v_player_spider.power_score - v_opponent.power_score)::numeric / GREATEST(1, v_player_spider.power_score);
  v_matchup_score := GREATEST(1, round(100 - v_power_gap * 100, 2));

  RETURN jsonb_build_object(
    'available', true,
    'range_used', v_power_gap,
    'matchup_score', v_matchup_score,
    'daily_limit', v_daily_limit,
    'skirmishes_used_today', v_today_count,
    'skirmishes_remaining_today', v_daily_limit - v_today_count,
    'player_spider', jsonb_build_object(
      'id', v_player_spider.id, 'owner_id', v_player_spider.owner_id,
      'nickname', v_player_spider.nickname, 'species', v_player_spider.species,
      'image_url', v_player_spider.image_url, 'power_score', v_player_spider.power_score,
      'hit_points', v_player_spider.hit_points, 'damage', v_player_spider.damage,
      'speed', v_player_spider.speed, 'defense', v_player_spider.defense,
      'venom', v_player_spider.venom, 'webcraft', v_player_spider.webcraft
    ),
    'opponent_spider', jsonb_build_object(
      'id', v_opponent.id, 'owner_id', v_opponent.owner_id,
      'nickname', v_opponent.nickname, 'species', v_opponent.species,
      'image_url', v_opponent.image_url, 'power_score', v_opponent.power_score,
      'hit_points', v_opponent.hit_points, 'damage', v_opponent.damage,
      'speed', v_opponent.speed, 'defense', v_opponent.defense,
      'venom', v_opponent.venom, 'webcraft', v_opponent.webcraft
    )
  );
END;
$fn$;

-- 5. Award XP to battle winners in resolve_battle_challenge
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

  -- Improve winning spider stats
  stat_improvements := public.improve_spider_after_victory(winner_spider);

  -- Transfer spider ownership
  PERFORM public.transfer_spider_ownership(loser_spider, winner_user_id);

  -- Award XP to battle winner
  UPDATE public.profiles SET xp = xp + v_battle_xp WHERE id = winner_user_id;

  -- Update challenge status
  UPDATE public.battle_challenges
  SET status = 'COMPLETED',
      battle_id = battle_id_param,
      winner_id = winner_user_id,
      loser_spider_id = loser_spider
  WHERE id = challenge_id;

  RETURN stat_improvements || jsonb_build_object('battle_xp_awarded', v_battle_xp);
END;
$function$;
