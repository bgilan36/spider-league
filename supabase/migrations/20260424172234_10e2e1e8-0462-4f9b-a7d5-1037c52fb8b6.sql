
-- 1. Updated standings function: timeframe + streak support
CREATE OR REPLACE FUNCTION public.get_private_league_standings(
  league_id uuid,
  timeframe text DEFAULT 'weekly'
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  wins integer,
  losses integer,
  battles integer,
  win_rate numeric,
  streak integer,
  top_spider jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_since timestamptz;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_private_league_member(league_id, v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF timeframe = 'weekly' THEN
    v_since := public.get_current_pt_week_start();
  ELSE
    v_since := 'epoch'::timestamptz;
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT m.user_id, p.display_name, p.avatar_url
    FROM public.private_league_members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.league_id = get_private_league_standings.league_id
  ), battle_rows AS (
    SELECT
      b.created_at,
      (b.team_a->>'userId')::uuid AS a_user,
      (b.team_b->>'userId')::uuid AS b_user,
      CASE WHEN b.winner = 'A' THEN (b.team_a->>'userId')::uuid WHEN b.winner = 'B' THEN (b.team_b->>'userId')::uuid ELSE NULL END AS winner_user,
      CASE WHEN b.winner = 'A' THEN (b.team_b->>'userId')::uuid WHEN b.winner = 'B' THEN (b.team_a->>'userId')::uuid ELSE NULL END AS loser_user
    FROM public.battles b
    WHERE b.league_id = get_private_league_standings.league_id
      AND b.is_active = false
      AND b.created_at >= v_since
  ), per_user AS (
    SELECT
      m.user_id,
      m.display_name,
      m.avatar_url,
      COALESCE(count(*) FILTER (WHERE br.winner_user = m.user_id), 0)::integer AS wins,
      COALESCE(count(*) FILTER (WHERE br.loser_user = m.user_id), 0)::integer AS losses,
      COALESCE(count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id), 0)::integer AS battles,
      CASE WHEN count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id) = 0 THEN 0
        ELSE round((count(*) FILTER (WHERE br.winner_user = m.user_id))::numeric * 100 / (count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id))::numeric, 1)
      END AS win_rate
    FROM members m
    LEFT JOIN battle_rows br ON br.a_user = m.user_id OR br.b_user = m.user_id
    GROUP BY m.user_id, m.display_name, m.avatar_url
  ), ordered_results AS (
    SELECT
      m.user_id,
      br.created_at,
      CASE WHEN br.winner_user = m.user_id THEN 1
           WHEN br.loser_user  = m.user_id THEN -1
           ELSE 0 END AS outcome
    FROM members m
    JOIN battle_rows br ON (br.a_user = m.user_id OR br.b_user = m.user_id)
  ), latest_per_user AS (
    SELECT user_id, outcome,
           row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
    FROM ordered_results
  ), streaks AS (
    SELECT u.user_id,
      COALESCE((
        WITH last_first AS (SELECT outcome FROM latest_per_user WHERE user_id = u.user_id AND rn = 1)
        SELECT CASE
          WHEN (SELECT outcome FROM last_first) = 0 THEN 0
          ELSE (SELECT outcome FROM last_first) * (
            SELECT count(*)::int FROM (
              SELECT outcome, rn,
                SUM(CASE WHEN outcome <> (SELECT outcome FROM last_first) THEN 1 ELSE 0 END)
                  OVER (ORDER BY rn) AS grp
              FROM latest_per_user WHERE user_id = u.user_id
            ) x WHERE grp = 0
          )
        END
      ), 0) AS streak
    FROM per_user u
  )
  SELECT
    pu.user_id,
    pu.display_name,
    pu.avatar_url,
    pu.wins,
    pu.losses,
    pu.battles,
    pu.win_rate,
    COALESCE(s.streak, 0) AS streak,
    COALESCE((
      SELECT jsonb_build_object('id', sp.id, 'nickname', sp.nickname, 'species', sp.species, 'image_url', sp.image_url, 'power_score', sp.power_score)
      FROM public.spiders sp
      WHERE sp.owner_id = pu.user_id AND sp.is_approved = true
      ORDER BY sp.power_score DESC
      LIMIT 1
    ), '{}'::jsonb) AS top_spider
  FROM per_user pu
  LEFT JOIN streaks s ON s.user_id = pu.user_id
  ORDER BY pu.wins DESC, pu.win_rate DESC, pu.battles DESC;
END;
$function$;

-- 2. Pod chat messages
CREATE TABLE public.pod_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id uuid NOT NULL REFERENCES public.private_leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pod_chat_messages_league_created ON public.pod_chat_messages(league_id, created_at DESC);
ALTER TABLE public.pod_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pod chat"
ON public.pod_chat_messages FOR SELECT TO authenticated
USING (public.is_private_league_member(league_id, auth.uid()));

CREATE POLICY "Members can post pod chat"
ON public.pod_chat_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_private_league_member(league_id, auth.uid()));

CREATE POLICY "Authors can update own messages"
ON public.pod_chat_messages FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authors or owners can delete messages"
ON public.pod_chat_messages FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_private_league_owner(league_id, auth.uid()));

CREATE TRIGGER trg_pod_chat_messages_updated
BEFORE UPDATE ON public.pod_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Pod chat replies
CREATE TABLE public.pod_chat_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.pod_chat_messages(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.private_leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pod_chat_replies_message ON public.pod_chat_replies(message_id, created_at);
ALTER TABLE public.pod_chat_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pod replies"
ON public.pod_chat_replies FOR SELECT TO authenticated
USING (public.is_private_league_member(league_id, auth.uid()));

CREATE POLICY "Members can post pod replies"
ON public.pod_chat_replies FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_private_league_member(league_id, auth.uid()));

CREATE POLICY "Authors can update own replies"
ON public.pod_chat_replies FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authors or owners can delete replies"
ON public.pod_chat_replies FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_private_league_owner(league_id, auth.uid()));

CREATE TRIGGER trg_pod_chat_replies_updated
BEFORE UPDATE ON public.pod_chat_replies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Pod chat likes
CREATE TABLE public.pod_chat_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.pod_chat_messages(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.private_leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
ALTER TABLE public.pod_chat_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pod likes"
ON public.pod_chat_likes FOR SELECT TO authenticated
USING (public.is_private_league_member(league_id, auth.uid()));

CREATE POLICY "Members can like pod messages"
ON public.pod_chat_likes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_private_league_member(league_id, auth.uid()));

CREATE POLICY "Users can remove their own like"
ON public.pod_chat_likes FOR DELETE TO authenticated
USING (auth.uid() = user_id);
