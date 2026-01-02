-- Create the improve_spider_after_victory function
CREATE OR REPLACE FUNCTION public.improve_spider_after_victory(winner_spider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stat_to_improve text;
  improvement_amount integer;
  stats text[] := ARRAY['hit_points', 'damage', 'speed', 'defense', 'venom', 'webcraft'];
  improvements jsonb := '{}'::jsonb;
  current_val integer;
  new_val integer;
  i integer;
  num_stats_to_improve integer;
BEGIN
  -- Randomly improve 1-3 stats
  num_stats_to_improve := 1 + floor(random() * 3)::integer;
  
  FOR i IN 1..num_stats_to_improve LOOP
    -- Pick a random stat
    stat_to_improve := stats[1 + floor(random() * 6)::integer];
    
    -- Random improvement between 1-3 points
    improvement_amount := 1 + floor(random() * 3)::integer;
    
    -- Get current value and calculate new value (cap at 100)
    EXECUTE format('SELECT %I FROM spiders WHERE id = $1', stat_to_improve)
    INTO current_val
    USING winner_spider_id;
    
    new_val := LEAST(100, current_val + improvement_amount);
    improvement_amount := new_val - current_val;
    
    -- Only update if there's actual improvement
    IF improvement_amount > 0 THEN
      EXECUTE format('UPDATE spiders SET %I = $1, power_score = power_score + $2, updated_at = now() WHERE id = $3', stat_to_improve)
      USING new_val, improvement_amount, winner_spider_id;
      
      -- Track the improvement
      improvements := improvements || jsonb_build_object(stat_to_improve, improvement_amount);
    END IF;
  END LOOP;
  
  RETURN improvements;
END;
$$;