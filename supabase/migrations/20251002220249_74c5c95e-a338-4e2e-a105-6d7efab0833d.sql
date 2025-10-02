-- Resolve all active battles that are stuck
-- Mark them as complete with a tie result based on power score
UPDATE battles
SET 
  is_active = false,
  winner = CASE 
    WHEN ((team_a->'spider'->>'power_score')::int >= (team_b->'spider'->>'power_score')::int) THEN 'A'::battle_winner
    ELSE 'B'::battle_winner
  END,
  p1_current_hp = COALESCE(p1_current_hp, (team_a->'spider'->>'hit_points')::int),
  p2_current_hp = COALESCE(p2_current_hp, (team_b->'spider'->>'hit_points')::int)
WHERE is_active = true;