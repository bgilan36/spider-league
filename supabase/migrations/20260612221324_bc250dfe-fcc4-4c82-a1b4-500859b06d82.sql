
-- 1. Profile settings flags
ALTER TABLE public.profile_settings
  ADD COLUMN IF NOT EXISTS rookie_season_dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rookie_season_completed boolean NOT NULL DEFAULT false;

-- 2. Seed badge (idempotent)
INSERT INTO public.badges (name, description, icon, rarity, criteria)
SELECT 'Rookie Season Champion',
       'Completed all four Rookie Season onboarding steps.',
       '🎓',
       'epic',
       '{"type":"rookie_season"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.badges WHERE name = 'Rookie Season Champion'
);

-- 3. Progress RPC
CREATE OR REPLACE FUNCTION public.get_rookie_season_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_caught boolean;
  v_won boolean;
  v_podded boolean;
  v_challenged boolean;
  v_completed boolean;
  v_dismissed boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  SELECT (count(*) > 1) INTO v_caught
  FROM public.spiders WHERE owner_id = v_user;

  SELECT EXISTS (
    SELECT 1 FROM public.battle_challenges WHERE winner_id = v_user
    UNION ALL
    SELECT 1 FROM public.spider_skirmishes s
      WHERE s.initiator_user_id = v_user AND s.winner_side = 'A'
  ) INTO v_won;

  SELECT EXISTS (
    SELECT 1 FROM public.private_league_members WHERE user_id = v_user
  ) INTO v_podded;

  SELECT EXISTS (
    SELECT 1 FROM public.battle_challenges WHERE challenger_id = v_user
  ) INTO v_challenged;

  SELECT COALESCE(rookie_season_completed,false),
         COALESCE(rookie_season_dismissed,false)
    INTO v_completed, v_dismissed
  FROM public.profile_settings WHERE id = v_user;

  RETURN jsonb_build_object(
    'caught', COALESCE(v_caught,false),
    'won', COALESCE(v_won,false),
    'podded', COALESCE(v_podded,false),
    'challenged', COALESCE(v_challenged,false),
    'completed', COALESCE(v_completed,false),
    'dismissed', COALESCE(v_dismissed,false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rookie_season_progress() TO authenticated;

-- 4. Completion RPC
CREATE OR REPLACE FUNCTION public.complete_rookie_season()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_progress jsonb;
  v_badge_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'error','not_authenticated');
  END IF;

  v_progress := public.get_rookie_season_progress();

  IF NOT ((v_progress->>'caught')::boolean
      AND (v_progress->>'won')::boolean
      AND (v_progress->>'podded')::boolean
      AND (v_progress->>'challenged')::boolean) THEN
    RETURN jsonb_build_object('awarded', false, 'reason','incomplete');
  END IF;

  IF (v_progress->>'completed')::boolean THEN
    RETURN jsonb_build_object('awarded', false, 'reason','already_completed');
  END IF;

  -- Mark completed
  INSERT INTO public.profile_settings (id, rookie_season_completed)
  VALUES (v_user, true)
  ON CONFLICT (id) DO UPDATE SET rookie_season_completed = true;

  -- Grant XP
  UPDATE public.profiles SET xp = COALESCE(xp,0) + 100 WHERE id = v_user;

  -- Award badge
  SELECT id INTO v_badge_id FROM public.badges WHERE name = 'Rookie Season Champion' LIMIT 1;
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (v_user, v_badge_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('awarded', true, 'xp', 100);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_rookie_season() TO authenticated;
