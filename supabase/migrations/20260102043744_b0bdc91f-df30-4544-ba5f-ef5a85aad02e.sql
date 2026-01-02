-- Drop the existing function first since we're changing its return type
DROP FUNCTION IF EXISTS public.resolve_battle_challenge(uuid, uuid, uuid, uuid);

-- Recreate resolve_battle_challenge to return JSONB with stat improvements
CREATE OR REPLACE FUNCTION public.resolve_battle_challenge(challenge_id uuid, winner_user_id uuid, loser_user_id uuid, battle_id_param uuid)
 RETURNS JSONB
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  challenge_record RECORD;
  loser_spider UUID;
  winner_spider UUID;
  stat_improvements JSONB;
BEGIN
  -- Get challenge details
  SELECT * INTO challenge_record
  FROM public.battle_challenges
  WHERE id = challenge_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;
  
  -- Determine which spider gets transferred and which spider won
  IF winner_user_id = challenge_record.challenger_id THEN
    loser_spider := challenge_record.accepter_spider_id;
    winner_spider := challenge_record.challenger_spider_id;
  ELSE
    loser_spider := challenge_record.challenger_spider_id;
    winner_spider := challenge_record.accepter_spider_id;
  END IF;
  
  -- Improve the winning spider's stats
  stat_improvements := public.improve_spider_after_victory(winner_spider);
  
  -- Transfer spider ownership
  PERFORM public.transfer_spider_ownership(loser_spider, winner_user_id);
  
  -- Update challenge status
  UPDATE public.battle_challenges
  SET status = 'COMPLETED',
      battle_id = battle_id_param,
      winner_id = winner_user_id,
      loser_spider_id = loser_spider
  WHERE id = challenge_id;
  
  RETURN stat_improvements;
END;
$function$;

-- Update process_battle_turn to capture stat improvements
CREATE OR REPLACE FUNCTION public.process_battle_turn(p_battle_id uuid, p_action_type text, p_action_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_battle RECORD;
  v_attacker_user_id UUID;
  v_defender_user_id UUID;
  v_attacker_hp INTEGER;
  v_defender_hp INTEGER;
  v_attacker_spider JSONB;
  v_defender_spider JSONB;
  v_damage INTEGER;
  v_result JSONB;
  v_new_turn_index INTEGER;
  v_next_turn_user_id UUID;
  v_winner_user_id UUID;
  v_stat_improvements JSONB;
BEGIN
  -- Get battle details with lock
  SELECT * INTO v_battle
  FROM public.battles
  WHERE id = p_battle_id
  AND is_active = true
  AND current_turn_user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found or not your turn';
  END IF;

  -- Determine attacker and defender
  IF (v_battle.team_a->>'userId')::uuid = auth.uid() THEN
    v_attacker_user_id := auth.uid();
    v_defender_user_id := (v_battle.team_b->>'userId')::uuid;
    v_attacker_hp := v_battle.p1_current_hp;
    v_defender_hp := v_battle.p2_current_hp;
    v_attacker_spider := v_battle.team_a->'spider';
    v_defender_spider := v_battle.team_b->'spider';
  ELSE
    v_attacker_user_id := auth.uid();
    v_defender_user_id := (v_battle.team_a->>'userId')::uuid;
    v_attacker_hp := v_battle.p2_current_hp;
    v_defender_hp := v_battle.p1_current_hp;
    v_attacker_spider := v_battle.team_b->'spider';
    v_defender_spider := v_battle.team_a->'spider';
  END IF;

  -- Calculate damage based on action type
  IF p_action_type = 'attack' THEN
    v_damage := (v_attacker_spider->>'damage')::integer + 
                floor(random() * 10) - 
                floor((v_defender_spider->>'defense')::integer / 10);
    v_damage := GREATEST(1, v_damage);
    v_defender_hp := GREATEST(0, v_defender_hp - v_damage);
    
    v_result := jsonb_build_object(
      'action', 'attack',
      'damage', v_damage,
      'new_defender_hp', v_defender_hp
    );
  ELSIF p_action_type = 'special' THEN
    v_damage := (v_attacker_spider->>'venom')::integer + 
                floor(random() * 15) - 
                floor((v_defender_spider->>'defense')::integer / 8);
    v_damage := GREATEST(2, v_damage);
    v_defender_hp := GREATEST(0, v_defender_hp - v_damage);
    
    v_result := jsonb_build_object(
      'action', 'special',
      'damage', v_damage,
      'new_defender_hp', v_defender_hp
    );
  ELSE
    v_result := jsonb_build_object(
      'action', p_action_type,
      'message', 'Action executed'
    );
  END IF;

  -- Insert turn record
  v_new_turn_index := v_battle.turn_count + 1;
  INSERT INTO public.battle_turns (
    battle_id,
    turn_index,
    actor_user_id,
    action_type,
    action_payload,
    result_payload
  ) VALUES (
    p_battle_id,
    v_new_turn_index,
    v_attacker_user_id,
    p_action_type,
    p_action_payload,
    v_result
  );

  -- Update battle state
  IF (v_battle.team_a->>'userId')::uuid = auth.uid() THEN
    v_next_turn_user_id := v_defender_user_id;
    UPDATE public.battles
    SET p2_current_hp = v_defender_hp,
        turn_count = v_new_turn_index,
        current_turn_user_id = v_next_turn_user_id
    WHERE id = p_battle_id;
  ELSE
    v_next_turn_user_id := v_defender_user_id;
    UPDATE public.battles
    SET p1_current_hp = v_defender_hp,
        turn_count = v_new_turn_index,
        current_turn_user_id = v_next_turn_user_id
    WHERE id = p_battle_id;
  END IF;

  -- Check for winner
  IF v_defender_hp <= 0 THEN
    v_winner_user_id := v_attacker_user_id;
    
    -- Update battle to mark as complete
    UPDATE public.battles
    SET winner = CASE 
                   WHEN (team_a->>'userId')::uuid = v_winner_user_id THEN 'A'::battle_winner
                   ELSE 'B'::battle_winner
                 END,
        is_active = false
    WHERE id = p_battle_id;
    
    -- If this battle is linked to a challenge, resolve it and get stat improvements
    IF v_battle.challenge_id IS NOT NULL THEN
      v_stat_improvements := public.resolve_battle_challenge(
        v_battle.challenge_id,
        v_winner_user_id,
        v_defender_user_id,
        p_battle_id
      );
    END IF;
    
    -- Award badges to the winner
    PERFORM public.award_badges_for_user(v_winner_user_id);
    
    v_result := v_result || jsonb_build_object(
      'battle_ended', true, 
      'winner', v_winner_user_id,
      'challenge_resolved', v_battle.challenge_id IS NOT NULL,
      'stat_improvements', COALESCE(v_stat_improvements, '{}'::JSONB)
    );
  END IF;

  RETURN v_result;
END;
$function$;