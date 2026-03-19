
-- Step 1: Add xp and level columns to spiders table
ALTER TABLE public.spiders
  ADD COLUMN xp integer NOT NULL DEFAULT 0,
  ADD COLUMN level integer NOT NULL DEFAULT 1;

-- Step 2: Create helper function to calculate spider level from XP
CREATE OR REPLACE FUNCTION public.calculate_spider_level(spider_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN spider_xp >= 2000 THEN 10
    WHEN spider_xp >= 1500 THEN 9
    WHEN spider_xp >= 1100 THEN 8
    WHEN spider_xp >= 800 THEN 7
    WHEN spider_xp >= 550 THEN 6
    WHEN spider_xp >= 360 THEN 5
    WHEN spider_xp >= 220 THEN 4
    WHEN spider_xp >= 120 THEN 3
    WHEN spider_xp >= 50 THEN 2
    ELSE 1
  END;
$$;

-- Step 3: Create helper function to get XP needed for next level
CREATE OR REPLACE FUNCTION public.xp_for_next_level(current_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE current_level
    WHEN 1 THEN 50
    WHEN 2 THEN 120
    WHEN 3 THEN 220
    WHEN 4 THEN 360
    WHEN 5 THEN 550
    WHEN 6 THEN 800
    WHEN 7 THEN 1100
    WHEN 8 THEN 1500
    WHEN 9 THEN 2000
    ELSE 2000 -- max level
  END;
$$;

-- Step 4: Create function to award spider XP, handle level-ups, and return info
CREATE OR REPLACE FUNCTION public.award_spider_xp(
  p_spider_id uuid,
  p_xp_amount integer,
  p_seed text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_xp integer;
  v_old_level integer;
  v_new_xp integer;
  v_new_level integer;
  v_levels_gained integer;
  v_level_up_stats jsonb := '{}'::jsonb;
  v_stats text[] := ARRAY['hit_points','damage','speed','defense','venom','webcraft'];
  v_stat_name text;
  v_stat_val integer;
  v_new_val integer;
  v_bump integer;
  v_hash bigint;
  v_owner_id uuid;
BEGIN
  -- Get current spider state
  SELECT xp, level, owner_id INTO v_old_xp, v_old_level, v_owner_id
  FROM public.spiders WHERE id = p_spider_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Spider not found');
  END IF;

  -- Calculate new XP and level
  v_new_xp := v_old_xp + p_xp_amount;
  v_new_level := public.calculate_spider_level(v_new_xp);
  v_levels_gained := v_new_level - v_old_level;

  -- Update spider XP and level
  UPDATE public.spiders
  SET xp = v_new_xp, level = v_new_level, updated_at = now()
  WHERE id = p_spider_id;

  -- Apply level-up stat bonuses (+2 to a random stat per level gained)
  IF v_levels_gained > 0 THEN
    FOR i IN 1..v_levels_gained LOOP
      v_hash := abs(hashtext(p_seed || ':levelup:' || i));
      v_stat_name := v_stats[1 + (v_hash % 6)];
      v_bump := 2;

      EXECUTE format('SELECT %I FROM spiders WHERE id = $1', v_stat_name)
        INTO v_stat_val USING p_spider_id;

      v_new_val := LEAST(100, v_stat_val + v_bump);
      v_bump := v_new_val - v_stat_val;

      IF v_bump > 0 THEN
        EXECUTE format('UPDATE spiders SET %I = $1, power_score = power_score + $2, updated_at = now() WHERE id = $3', v_stat_name)
          USING v_new_val, v_bump, p_spider_id;
        v_level_up_stats := v_level_up_stats || jsonb_build_object(v_stat_name, v_bump);
      END IF;
    END LOOP;

    -- Award user XP for spider level-ups (5 XP per level gained)
    UPDATE public.profiles SET xp = xp + (v_levels_gained * 5) WHERE id = v_owner_id;
  END IF;

  RETURN jsonb_build_object(
    'spider_id', p_spider_id,
    'xp_gained', p_xp_amount,
    'old_xp', v_old_xp,
    'new_xp', v_new_xp,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'leveled_up', v_levels_gained > 0,
    'levels_gained', v_levels_gained,
    'level_up_stats', v_level_up_stats,
    'user_xp_from_levelup', v_levels_gained * 5
  );
END;
$$;
