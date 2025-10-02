-- Add turn-based battle support to battles table
ALTER TABLE public.battles
ADD COLUMN IF NOT EXISTS current_turn_user_id UUID,
ADD COLUMN IF NOT EXISTS turn_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS p1_current_hp INTEGER,
ADD COLUMN IF NOT EXISTS p2_current_hp INTEGER,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create battle_turns table for turn-by-turn gameplay
CREATE TABLE IF NOT EXISTS public.battle_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  actor_user_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('attack', 'defend', 'special', 'pass')),
  action_payload JSONB NOT NULL DEFAULT '{}',
  result_payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (battle_id, turn_index)
);

-- Enable RLS
ALTER TABLE public.battle_turns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Battle participants can view turns" ON public.battle_turns;
DROP POLICY IF EXISTS "Battle participants can insert turns" ON public.battle_turns;

-- RLS Policies for battle_turns
CREATE POLICY "Battle participants can view turns"
  ON public.battle_turns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.battles
      WHERE id = battle_turns.battle_id
      AND (
        (team_a->>'userId')::uuid = auth.uid()
        OR (team_b->>'userId')::uuid = auth.uid()
      )
    )
  );

CREATE POLICY "Battle participants can insert turns"
  ON public.battle_turns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.battles
      WHERE id = battle_turns.battle_id
      AND current_turn_user_id = auth.uid()
      AND is_active = true
    )
  );

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS battle_turns_battle_id_idx ON public.battle_turns(battle_id, turn_index);
CREATE INDEX IF NOT EXISTS battles_active_idx ON public.battles(is_active) WHERE is_active = true;

-- Enable realtime for battle_turns
ALTER TABLE public.battle_turns REPLICA IDENTITY FULL;

-- Function to validate and process battle turn
CREATE OR REPLACE FUNCTION public.process_battle_turn(
  p_battle_id UUID,
  p_action_type TEXT,
  p_action_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    UPDATE public.battles
    SET winner = CASE 
                   WHEN (team_a->>'userId')::uuid = auth.uid() THEN 'TEAM_A'::battle_winner
                   ELSE 'TEAM_B'::battle_winner
                 END,
        is_active = false
    WHERE id = p_battle_id;
    
    v_result := v_result || jsonb_build_object('battle_ended', true, 'winner', auth.uid());
  END IF;

  RETURN v_result;
END;
$$;