ALTER TABLE public.profile_settings ADD COLUMN IF NOT EXISTS rookie_rewards_claimed text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.get_rookie_season_progress()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_trained boolean; v_caught boolean; v_friendly boolean; v_podded boolean;
  v_completed boolean; v_dismissed boolean; v_claimed text[];
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.battles b
    WHERE b.is_active = false AND b.winner IS NOT NULL
      AND ((b.team_a->>'userId')::uuid = v_user OR (b.team_b->>'userId')::uuid = v_user)
  ) INTO v_trained;

  SELECT EXISTS (
    SELECT 1 FROM public.spiders s WHERE s.owner_id = v_user
      AND s.image_url NOT LIKE '%starter-spider%'
      AND s.created_at > (SELECT MIN(created_at) FROM public.spiders WHERE owner_id = v_user)
  ) OR (SELECT count(*) > 1 FROM public.spiders WHERE owner_id = v_user) INTO v_caught;

  SELECT EXISTS (
    SELECT 1 FROM public.battle_challenges c
    WHERE (c.challenger_id = v_user OR c.accepter_id = v_user)
      AND c.is_all_or_nothing = false AND c.battle_id IS NOT NULL
      AND COALESCE(c.challenge_message,'') NOT IN ('Skill Battle','Pod Skill Battle','Practice Battle')
  ) INTO v_friendly;

  SELECT EXISTS (SELECT 1 FROM public.private_league_members WHERE user_id = v_user) INTO v_podded;

  SELECT COALESCE(rookie_season_completed,false), COALESCE(rookie_season_dismissed,false), COALESCE(rookie_rewards_claimed,'{}')
    INTO v_completed, v_dismissed, v_claimed
  FROM public.profile_settings WHERE id = v_user;

  RETURN jsonb_build_object(
    'trained', COALESCE(v_trained,false), 'caught', COALESCE(v_caught,false),
    'friendly', COALESCE(v_friendly,false), 'podded', COALESCE(v_podded,false),
    'completed', COALESCE(v_completed,false), 'dismissed', COALESCE(v_dismissed,false),
    'claimed', to_jsonb(COALESCE(v_claimed,'{}'::text[]))
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_rookie_milestone(p_step text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_progress jsonb; v_claimed text[];
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('awarded', false, 'reason','not_authenticated'); END IF;
  IF p_step NOT IN ('trained','caught','friendly','podded') THEN
    RETURN jsonb_build_object('awarded', false, 'reason','unknown_step');
  END IF;
  v_progress := public.get_rookie_season_progress();
  IF NOT COALESCE((v_progress->>p_step)::boolean,false) THEN
    RETURN jsonb_build_object('awarded', false, 'reason','incomplete');
  END IF;
  INSERT INTO public.profile_settings (id) VALUES (v_user) ON CONFLICT (id) DO NOTHING;
  SELECT rookie_rewards_claimed INTO v_claimed FROM public.profile_settings WHERE id = v_user FOR UPDATE;
  IF p_step = ANY(COALESCE(v_claimed,'{}')) THEN
    RETURN jsonb_build_object('awarded', false, 'reason','already_claimed');
  END IF;
  UPDATE public.profile_settings SET rookie_rewards_claimed = array_append(COALESCE(rookie_rewards_claimed,'{}'), p_step) WHERE id = v_user;
  UPDATE public.profiles SET xp = COALESCE(xp,0) + 25 WHERE id = v_user;
  RETURN jsonb_build_object('awarded', true, 'xp', 25, 'step', p_step);
END; $function$;

REVOKE ALL ON FUNCTION public.claim_rookie_milestone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_rookie_milestone(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_rookie_season()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_progress jsonb; v_badge_id uuid; v_done boolean;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('awarded', false, 'error','not_authenticated'); END IF;
  v_progress := public.get_rookie_season_progress();
  IF NOT ((v_progress->>'trained')::boolean AND (v_progress->>'caught')::boolean
      AND (v_progress->>'friendly')::boolean AND (v_progress->>'podded')::boolean) THEN
    RETURN jsonb_build_object('awarded', false, 'reason','incomplete');
  END IF;
  INSERT INTO public.profile_settings (id) VALUES (v_user) ON CONFLICT (id) DO NOTHING;
  SELECT rookie_season_completed INTO v_done FROM public.profile_settings WHERE id = v_user FOR UPDATE;
  IF COALESCE(v_done,false) THEN RETURN jsonb_build_object('awarded', false, 'reason','already_completed'); END IF;
  UPDATE public.profile_settings SET rookie_season_completed = true WHERE id = v_user;
  UPDATE public.profiles SET xp = COALESCE(xp,0) + 100 WHERE id = v_user;
  SELECT id INTO v_badge_id FROM public.badges WHERE name = 'Rookie Season Champion' LIMIT 1;
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (v_user, v_badge_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('awarded', true, 'xp', 100);
END; $function$;

-- rookie_rewards_claimed must only change through claim_rookie_milestone
CREATE OR REPLACE FUNCTION public.protect_rookie_rewards()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('postgres','service_role','supabase_admin') AND pg_trigger_depth() = 1
     AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN NEW.rookie_rewards_claimed := '{}';
    ELSE NEW.rookie_rewards_claimed := OLD.rookie_rewards_claimed; END IF;
  END IF;
  RETURN NEW;
END; $function$;
DROP TRIGGER IF EXISTS protect_rookie_rewards ON public.profile_settings;
CREATE TRIGGER protect_rookie_rewards BEFORE INSERT OR UPDATE ON public.profile_settings
FOR EACH ROW EXECUTE FUNCTION public.protect_rookie_rewards();