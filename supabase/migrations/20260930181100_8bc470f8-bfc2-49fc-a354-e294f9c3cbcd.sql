
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
UPDATE public.profiles p SET is_demo = true FROM auth.users u WHERE u.id = p.id AND u.email LIKE 'demo+%@spiderleague.com';

CREATE OR REPLACE FUNCTION public.protect_profile_is_demo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_demo IS DISTINCT FROM OLD.is_demo AND coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.is_demo := OLD.is_demo;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_profile_is_demo ON public.profiles;
CREATE TRIGGER trg_protect_profile_is_demo BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_is_demo();

CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT is_demo FROM public.profiles WHERE id = _user_id), false)
$$;

ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS battles_idempotency_key_uniq ON public.battles(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Hide demo spiders from everyone but their owner
DROP POLICY IF EXISTS "Demo spiders visible only to owner" ON public.spiders;
CREATE POLICY "Demo spiders visible only to owner" ON public.spiders AS RESTRICTIVE FOR SELECT
USING (owner_id = auth.uid() OR NOT public.is_demo_user(owner_id));

-- No Battle-to-the-Death for demo accounts
DROP POLICY IF EXISTS "Demo users cannot stake spiders" ON public.battle_challenges;
CREATE POLICY "Demo users cannot stake spiders" ON public.battle_challenges AS RESTRICTIVE FOR INSERT
WITH CHECK (is_all_or_nothing = false OR NOT public.is_demo_user(auth.uid()));
DROP POLICY IF EXISTS "Demo users cannot accept staked challenges" ON public.battle_challenges;
CREATE POLICY "Demo users cannot accept staked challenges" ON public.battle_challenges AS RESTRICTIVE FOR UPDATE
USING (is_all_or_nothing = false OR NOT public.is_demo_user(auth.uid()))
WITH CHECK (is_all_or_nothing = false OR NOT public.is_demo_user(auth.uid()));

-- Fix starter creation (unqualified gen_random_bytes failed under empty search_path) + flag demo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  user_display_name TEXT;
  attr_hp INTEGER; attr_dmg INTEGER; attr_spd INTEGER; attr_def INTEGER; attr_vnm INTEGER; attr_web INTEGER;
  total_stats INTEGER; new_spider_id UUID;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, is_demo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    (NEW.email LIKE 'demo+%@spiderleague.com')
  );
  SELECT display_name INTO user_display_name FROM public.profiles WHERE id = NEW.id;
  attr_hp := 30 + floor(random() * 20); attr_dmg := 30 + floor(random() * 20);
  attr_spd := 30 + floor(random() * 20); attr_def := 30 + floor(random() * 20);
  attr_vnm := 30 + floor(random() * 20); attr_web := 30 + floor(random() * 20);
  total_stats := attr_hp + attr_dmg + attr_spd + attr_def + attr_vnm + attr_web;
  attr_hp := attr_hp + (250 - total_stats);
  BEGIN
    INSERT INTO public.spiders (owner_id, nickname, species, image_url, rarity, hit_points, damage, speed, defense, venom, webcraft, power_score, is_approved, rng_seed)
    VALUES (NEW.id, user_display_name || '''s Starter Spider', 'Spider League Starter Spider',
      'https://wdqsgswrkrxjeesahshc.supabase.co/storage/v1/object/public/spiders/starter-spider.png',
      'COMMON', attr_hp, attr_dmg, attr_spd, attr_def, attr_vnm, attr_web, 250, true,
      md5(random()::text || clock_timestamp()::text))
    RETURNING id INTO new_spider_id;
    PERFORM public.increment_weekly_upload(NEW.id, new_spider_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create starter spider for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END; $function$;

-- Exclude demo from public/competitive surfaces
CREATE OR REPLACE FUNCTION public.announce_legendary_spider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.rarity = 'LEGENDARY' AND NOT public.is_demo_user(NEW.owner_id) THEN
    INSERT INTO public.global_chat_messages (user_id, message)
    VALUES (NEW.owner_id, '🚨 A LEGENDARY spider has entered the league — ' || COALESCE(NEW.nickname, 'Unknown') ||
      ' (' || COALESCE(NEW.species, 'Unknown species') || ') • Power ' || NEW.power_score);
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.award_local_legends_for_current_week()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_wk_start DATE; v_badge_id UUID; v_inserted INT := 0; r RECORD;
BEGIN
  v_wk_start := (date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles')))::DATE;
  SELECT id INTO v_badge_id FROM public.badges WHERE name = 'Local Legend' LIMIT 1;
  IF v_badge_id IS NULL THEN RETURN 0; END IF;
  FOR r IN
    SELECT DISTINCT ON (s.city_key) s.city_key, s.id AS spider_id, s.owner_id, s.power_score
    FROM public.spiders s
    WHERE s.city_key IS NOT NULL AND s.is_approved = true AND NOT public.is_demo_user(s.owner_id)
      AND s.created_at >= (v_wk_start::timestamptz AT TIME ZONE 'America/Los_Angeles')
    ORDER BY s.city_key, s.power_score DESC, s.created_at ASC
  LOOP
    INSERT INTO public.local_legend_winners(week_start, city_key, spider_id, user_id, power_score)
    VALUES (v_wk_start, r.city_key, r.spider_id, r.owner_id, r.power_score) ON CONFLICT (week_start, city_key) DO NOTHING;
    INSERT INTO public.user_badges (user_id, badge_id) VALUES (r.owner_id, v_badge_id) ON CONFLICT DO NOTHING;
    v_inserted := v_inserted + 1;
  END LOOP;
  RETURN v_inserted;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_city_leaderboard(p_city_key text, p_limit integer DEFAULT 25)
RETURNS TABLE(spider_id uuid, owner_id uuid, nickname text, species text, image_url text, rarity spider_rarity, power_score integer, owner_display_name text, rank_position integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH wk AS (SELECT (date_trunc('week', (now() AT TIME ZONE 'America/Los_Angeles')) AT TIME ZONE 'America/Los_Angeles') AS wk_start)
  SELECT s.id, s.owner_id, s.nickname, s.species, s.image_url, s.rarity, s.power_score, p.display_name,
         ROW_NUMBER() OVER (ORDER BY s.power_score DESC, s.created_at ASC)::INT
  FROM public.spiders s LEFT JOIN public.profiles p ON p.id = s.owner_id CROSS JOIN wk
  WHERE s.city_key = lower(btrim(p_city_key)) AND s.is_approved = true AND s.created_at >= wk.wk_start
    AND coalesce(p.is_demo, false) = false
  ORDER BY s.power_score DESC, s.created_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit,25), 100));
$function$;

CREATE OR REPLACE FUNCTION public.get_recent_public_skirmishes(row_limit integer DEFAULT 24)
RETURNS TABLE(id uuid, created_at timestamp with time zone, winner_side text, player_spider_snapshot jsonb, opponent_spider_snapshot jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE safe_limit integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  safe_limit := LEAST(GREATEST(COALESCE(row_limit, 24), 1), 50);
  RETURN QUERY
  SELECT s.id, s.created_at, s.winner_side, s.player_spider_snapshot, s.opponent_spider_snapshot
  FROM public.spider_skirmishes s
  WHERE s.winner_side IS NOT NULL AND NOT public.is_demo_user(s.initiator_user_id)
  ORDER BY s.created_at DESC LIMIT safe_limit;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_top_spider_in_area(p_lat double precision, p_lng double precision, p_radius_deg double precision DEFAULT 0.5)
RETURNS TABLE(spider_id uuid, owner_id uuid, nickname text, species text, image_url text, rarity spider_rarity, power_score integer, location_name text, city_key text, owner_display_name text, area_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH in_area AS (
    SELECT s.* FROM public.spiders s
    JOIN public.profile_settings ps ON ps.id = s.owner_id
    JOIN public.profiles pr ON pr.id = s.owner_id AND pr.is_demo = false
    WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL AND ps.share_spider_locations = true AND s.is_approved = true
      AND s.latitude BETWEEN p_lat - p_radius_deg AND p_lat + p_radius_deg
      AND s.longitude BETWEEN p_lng - p_radius_deg AND p_lng + p_radius_deg
  )
  SELECT s.id, s.owner_id, s.nickname, s.species, s.image_url, s.rarity, s.power_score, s.location_name, s.city_key,
         p.display_name, (SELECT COUNT(*) FROM in_area)::BIGINT
  FROM in_area s LEFT JOIN public.profiles p ON p.id = s.owner_id
  ORDER BY s.power_score DESC, s.created_at ASC LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_rankings_all_time()
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, total_power_score integer, spider_count integer, experience_points integer, ranking_score integer, top_spider jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN QUERY
  SELECT s.owner_id, p.display_name, p.avatar_url, SUM(s.power_score)::integer, COUNT(s.id)::integer,
    COALESCE(SUM(s.xp), 0)::integer, (SUM(s.power_score) + COALESCE(SUM(s.xp),0))::integer,
    jsonb_build_object('id', max_spider.id, 'nickname', max_spider.nickname, 'species', max_spider.species,
      'image_url', max_spider.image_url, 'power_score', max_spider.power_score, 'rarity', max_spider.rarity)
  FROM public.spiders s
  LEFT JOIN public.profiles p ON s.owner_id = p.id
  LEFT JOIN LATERAL (SELECT id, nickname, species, image_url, power_score, rarity FROM public.spiders s2
    WHERE s2.owner_id = s.owner_id AND s2.is_approved = true ORDER BY s2.power_score DESC LIMIT 1) max_spider ON true
  WHERE s.is_approved = true AND coalesce(p.is_demo, false) = false
  GROUP BY s.owner_id, p.display_name, p.avatar_url, max_spider.id, max_spider.nickname, max_spider.species,
           max_spider.image_url, max_spider.power_score, max_spider.rarity
  ORDER BY (SUM(s.power_score) + COALESCE(SUM(s.xp),0)) DESC;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_user_rankings_weekly(week_id_param uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, week_power_score integer, week_spider_count integer, spiders_acquired_in_battle integer, experience_points integer, ranking_score integer, top_spider jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE week_start_date timestamp; week_end_date timestamp;
BEGIN
  SELECT w.start_date, w.end_date INTO week_start_date, week_end_date FROM public.weeks w WHERE w.id = week_id_param;
  RETURN QUERY
  SELECT s.owner_id, p.display_name, p.avatar_url, SUM(s.power_score)::integer, COUNT(s.id)::integer,
    COUNT(CASE WHEN bc.battle_id IS NOT NULL THEN 1 END)::integer, COALESCE(SUM(s.xp),0)::integer,
    (SUM(s.power_score) + COALESCE(SUM(s.xp),0))::integer,
    jsonb_build_object('id', max_spider.id, 'nickname', max_spider.nickname, 'species', max_spider.species,
      'image_url', max_spider.image_url, 'power_score', max_spider.power_score, 'rarity', max_spider.rarity)
  FROM public.spiders s
  LEFT JOIN public.profiles p ON s.owner_id = p.id
  LEFT JOIN public.battle_challenges bc ON (s.id = bc.loser_spider_id AND bc.winner_id = s.owner_id AND bc.status = 'COMPLETED'
    AND bc.created_at >= week_start_date AND bc.created_at <= week_end_date)
  LEFT JOIN LATERAL (SELECT id, nickname, species, image_url, power_score, rarity FROM public.spiders s2
    WHERE s2.owner_id = s.owner_id AND s2.is_approved = true ORDER BY s2.power_score DESC LIMIT 1) max_spider ON true
  WHERE s.is_approved = true AND coalesce(p.is_demo, false) = false
    AND ((s.created_at >= week_start_date AND s.created_at <= week_end_date) OR (bc.battle_id IS NOT NULL))
  GROUP BY s.owner_id, p.display_name, p.avatar_url, max_spider.id, max_spider.nickname, max_spider.species,
           max_spider.image_url, max_spider.power_score, max_spider.rarity
  ORDER BY (SUM(s.power_score) + COALESCE(SUM(s.xp),0)) DESC;
END; $function$;

CREATE OR REPLACE FUNCTION public.select_spider_of_the_day()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE selected_spider_id UUID; today_date DATE := CURRENT_DATE;
BEGIN
  IF EXISTS (SELECT 1 FROM spider_of_the_day WHERE featured_date = today_date) THEN RETURN; END IF;
  SELECT id INTO selected_spider_id FROM spiders
  WHERE is_approved = true AND NOT public.is_demo_user(owner_id)
    AND id NOT IN (SELECT spider_id FROM spider_of_the_day WHERE featured_date > today_date - INTERVAL '30 days')
  ORDER BY random() LIMIT 1;
  IF selected_spider_id IS NULL THEN
    SELECT id INTO selected_spider_id FROM spiders WHERE is_approved = true AND NOT public.is_demo_user(owner_id) ORDER BY random() LIMIT 1;
  END IF;
  IF selected_spider_id IS NOT NULL THEN
    INSERT INTO spider_of_the_day (spider_id, featured_date, power_bonus) VALUES (selected_spider_id, today_date, 10);
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.update_weekly_rankings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE current_week_id UUID;
BEGIN
  current_week_id := public.get_current_week();
  DELETE FROM public.weekly_rankings WHERE week_id = current_week_id;
  INSERT INTO public.weekly_rankings (spider_id, week_id, power_score, rank_position)
  SELECT s.id, current_week_id, s.power_score, ROW_NUMBER() OVER (ORDER BY s.power_score DESC)
  FROM public.spiders s WHERE s.is_approved = true AND NOT public.is_demo_user(s.owner_id);
END; $function$;
