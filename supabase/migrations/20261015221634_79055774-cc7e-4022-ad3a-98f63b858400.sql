-- ===== Weeks =====
CREATE TABLE public.game_weeks (
  id text PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  locks_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','simulated','published')),
  champion_spider_id uuid,
  display_name text,
  is_test boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_weeks TO anon, authenticated;
GRANT ALL ON public.game_weeks TO service_role;
ALTER TABLE public.game_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Weeks are viewable" ON public.game_weeks FOR SELECT USING (is_test = false OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_game_weeks_updated BEFORE UPDATE ON public.game_weeks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Entries =====
CREATE TABLE public.weekly_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id text NOT NULL REFERENCES public.game_weeks(id) ON DELETE CASCADE,
  spider_id uuid NOT NULL REFERENCES public.spiders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_veteran boolean NOT NULL DEFAULT false,
  effective_power integer NOT NULL,
  is_auto boolean NOT NULL DEFAULT false,
  frozen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, spider_id)
);
CREATE INDEX idx_weekly_entries_week_user ON public.weekly_entries(week_id, user_id);
GRANT SELECT ON public.weekly_entries TO authenticated;
GRANT ALL ON public.weekly_entries TO service_role;
ALTER TABLE public.weekly_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Entries viewable by signed-in players" ON public.weekly_entries FOR SELECT TO authenticated USING (true);

-- ===== Brackets & matches =====
CREATE TABLE public.brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id text NOT NULL REFERENCES public.game_weeks(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('global','pod')),
  pod_id uuid REFERENCES public.private_leagues(id) ON DELETE CASCADE,
  size integer NOT NULL,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  champion_participant_id uuid,
  upset_match_id uuid,
  final_recap text,
  simulated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_brackets_week_type_pod ON public.brackets(week_id, type, COALESCE(pod_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT ON public.brackets TO anon, authenticated;
GRANT ALL ON public.brackets TO service_role;
ALTER TABLE public.brackets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published global brackets are public" ON public.brackets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.game_weeks w WHERE w.id = week_id AND w.status = 'published' AND w.is_test = false AND (type = 'global' OR auth.uid() IS NOT NULL))
    OR public.has_role(auth.uid(),'admin')
  );

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id uuid NOT NULL REFERENCES public.brackets(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  slot integer NOT NULL,
  spider_a_id uuid,
  spider_b_id uuid,
  winner_id uuid,
  is_upset boolean NOT NULL DEFAULT false,
  rounds jsonb NOT NULL DEFAULT '[]'::jsonb,
  commentary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bracket_id, round_number, slot)
);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches follow bracket visibility" ON public.matches FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.brackets b WHERE b.id = bracket_id));

-- ===== Seasons / standings / trophies =====
CREATE TABLE public.pod_season_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id text NOT NULL,
  pod_id uuid NOT NULL REFERENCES public.private_leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  points integer NOT NULL DEFAULT 0,
  best_finish integer,
  championships integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, pod_id, user_id)
);
CREATE TABLE public.pod_season_week_points (
  week_id text NOT NULL REFERENCES public.game_weeks(id) ON DELETE CASCADE,
  pod_id uuid NOT NULL,
  user_id uuid NOT NULL,
  season_id text NOT NULL,
  points integer NOT NULL,
  finish integer,
  is_champion boolean NOT NULL DEFAULT false,
  PRIMARY KEY (week_id, pod_id, user_id)
);
GRANT SELECT ON public.pod_season_standings, public.pod_season_week_points TO authenticated;
GRANT ALL ON public.pod_season_standings, public.pod_season_week_points TO service_role;
ALTER TABLE public.pod_season_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_season_week_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Standings viewable" ON public.pod_season_standings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Week points viewable" ON public.pod_season_week_points FOR SELECT TO authenticated USING (true);

CREATE TABLE public.trophies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('global_cup','pod_champion')),
  week_id text NOT NULL REFERENCES public.game_weeks(id) ON DELETE CASCADE,
  pod_id uuid,
  spider_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_trophies ON public.trophies(kind, week_id, COALESCE(pod_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT ON public.trophies TO anon, authenticated;
GRANT ALL ON public.trophies TO service_role;
ALTER TABLE public.trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trophies are public" ON public.trophies FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.game_weeks w WHERE w.id = week_id AND w.is_test = false) OR public.has_role(auth.uid(),'admin'));

-- ===== Pipeline log =====
CREATE TABLE public.tournament_pipeline_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id text,
  step text NOT NULL,
  status text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tournament_pipeline_log TO authenticated;
GRANT ALL ON public.tournament_pipeline_log TO service_role;
ALTER TABLE public.tournament_pipeline_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read pipeline log" ON public.tournament_pipeline_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ===== Views / analytics / email =====
CREATE TABLE public.result_views (
  user_id uuid NOT NULL,
  week_id text NOT NULL REFERENCES public.game_weeks(id) ON DELETE CASCADE,
  reached_champion boolean NOT NULL DEFAULT false,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_id)
);
GRANT SELECT, INSERT, UPDATE ON public.result_views TO authenticated;
GRANT ALL ON public.result_views TO service_role;
ALTER TABLE public.result_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own result views read" ON public.result_views FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own result views insert" ON public.result_views FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own result views update" ON public.result_views FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event text NOT NULL CHECK (event IN ('spider_uploaded','entry_changed','results_viewed','share_clicked','email_visit','app_visit')),
  week_id text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_events_created ON public.app_events(created_at);
GRANT INSERT ON public.app_events TO anon, authenticated;
GRANT SELECT ON public.app_events TO authenticated;
GRANT ALL ON public.app_events TO service_role;
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Log own events" ON public.app_events FOR INSERT TO anon, authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Admins read events" ON public.app_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('weekly_results','friday_nudge')),
  status text NOT NULL DEFAULT 'pending',
  subject text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_id, kind)
);
GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read email log" ON public.email_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.profile_settings
  ADD COLUMN IF NOT EXISTS weekly_results_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS friday_reminder_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS uq_profile_settings_unsub ON public.profile_settings(unsubscribe_token);

-- ===== Duplicate photo guard =====
ALTER TABLE public.spiders ADD COLUMN IF NOT EXISTS image_hash text;
CREATE INDEX IF NOT EXISTS idx_spiders_image_hash ON public.spiders(image_hash);
CREATE OR REPLACE FUNCTION public.reject_duplicate_spider_photo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.image_hash IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.spiders WHERE image_hash = NEW.image_hash AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_PHOTO' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reject_duplicate_spider_photo BEFORE INSERT ON public.spiders
  FOR EACH ROW EXECUTE FUNCTION public.reject_duplicate_spider_photo();

-- ===== Entry management RPCs =====
CREATE OR REPLACE FUNCTION public.current_open_game_week()
RETURNS public.game_weeks LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.game_weeks WHERE is_test = false AND status = 'open' AND now() < locks_at
  ORDER BY starts_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.set_my_week_entries(p_spider_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.game_weeks;
  uid uuid := auth.uid();
  n int;
  ok int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO w FROM public.current_open_game_week();
  IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Entries are locked for this week'); END IF;
  n := COALESCE(array_length(p_spider_ids,1),0);
  IF n > 3 THEN RETURN jsonb_build_object('ok', false, 'error', 'You can enter up to 3 spiders'); END IF;
  SELECT count(*) INTO ok FROM public.spiders s
    WHERE s.id = ANY(p_spider_ids) AND s.owner_id = uid AND s.is_approved IS NOT FALSE
      AND s.created_at >= w.starts_at AND s.created_at < w.locks_at;
  IF ok <> n THEN RETURN jsonb_build_object('ok', false, 'error', 'Only spiders you caught this week can be entered'); END IF;
  DELETE FROM public.weekly_entries WHERE week_id = w.id AND user_id = uid;
  INSERT INTO public.weekly_entries(week_id, spider_id, user_id, is_veteran, effective_power, is_auto)
    SELECT w.id, s.id, uid, false, s.power_score, false FROM public.spiders s WHERE s.id = ANY(p_spider_ids);
  RETURN jsonb_build_object('ok', true, 'week_id', w.id, 'count', n);
END $$;

CREATE OR REPLACE FUNCTION public.set_my_week_veteran(p_spider_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.game_weeks;
  uid uuid := auth.uid();
  fresh int;
  pw int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO w FROM public.current_open_game_week();
  IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Entries are locked for this week'); END IF;
  SELECT count(*) INTO fresh FROM public.spiders WHERE owner_id = uid AND created_at >= w.starts_at AND created_at < w.locks_at AND is_approved IS NOT FALSE;
  IF fresh > 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Veterans are only for weeks without a fresh catch'); END IF;
  DELETE FROM public.weekly_entries WHERE week_id = w.id AND user_id = uid;
  IF p_spider_id IS NULL THEN RETURN jsonb_build_object('ok', true, 'week_id', w.id, 'count', 0); END IF;
  SELECT power_score INTO pw FROM public.spiders WHERE id = p_spider_id AND owner_id = uid;
  IF pw IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'That spider is not yours'); END IF;
  INSERT INTO public.weekly_entries(week_id, spider_id, user_id, is_veteran, effective_power, is_auto)
    VALUES (w.id, p_spider_id, uid, true, round(pw * 0.85)::int, false);
  RETURN jsonb_build_object('ok', true, 'week_id', w.id, 'count', 1);
END $$;

REVOKE ALL ON FUNCTION public.set_my_week_entries(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_week_veteran(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_week_entries(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_week_veteran(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_open_game_week() TO anon, authenticated;

-- ===== Public unsubscribe =====
CREATE OR REPLACE FUNCTION public.unsubscribe_email(p_token uuid, p_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF p_kind = 'weekly_results' THEN
    UPDATE public.profile_settings SET weekly_results_email = false WHERE unsubscribe_token = p_token;
  ELSIF p_kind = 'friday_nudge' THEN
    UPDATE public.profile_settings SET friday_reminder_email = false WHERE unsubscribe_token = p_token;
  ELSE
    UPDATE public.profile_settings SET weekly_results_email = false, friday_reminder_email = false WHERE unsubscribe_token = p_token;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', n > 0);
END $$;
GRANT EXECUTE ON FUNCTION public.unsubscribe_email(uuid, text) TO anon, authenticated;