CREATE TABLE IF NOT EXISTS public.private_leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.private_league_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.private_leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.private_league_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.private_leagues(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.battle_challenges
ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.private_leagues(id) ON DELETE SET NULL;

ALTER TABLE public.battles
ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.private_leagues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_private_leagues_owner_id ON public.private_leagues(owner_id);
CREATE INDEX IF NOT EXISTS idx_private_league_members_league_id ON public.private_league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_private_league_members_user_id ON public.private_league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_private_league_invites_token ON public.private_league_invites(token);
CREATE INDEX IF NOT EXISTS idx_battle_challenges_league_id ON public.battle_challenges(league_id);
CREATE INDEX IF NOT EXISTS idx_battles_league_id ON public.battles(league_id);

ALTER TABLE public.private_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_league_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_private_league_member(_league_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.private_league_members
    WHERE league_id = _league_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_private_league_owner(_league_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.private_leagues
    WHERE id = _league_id AND owner_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Members can view their private leagues" ON public.private_leagues;
CREATE POLICY "Members can view their private leagues"
ON public.private_leagues
FOR SELECT
TO authenticated
USING (public.is_private_league_member(id, auth.uid()));

DROP POLICY IF EXISTS "Owners can update their private leagues" ON public.private_leagues;
CREATE POLICY "Owners can update their private leagues"
ON public.private_leagues
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Members can view league members" ON public.private_league_members;
CREATE POLICY "Members can view league members"
ON public.private_league_members
FOR SELECT
TO authenticated
USING (public.is_private_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage league members" ON public.private_league_members;
CREATE POLICY "Owners can manage league members"
ON public.private_league_members
FOR ALL
TO authenticated
USING (public.is_private_league_owner(league_id, auth.uid()))
WITH CHECK (public.is_private_league_owner(league_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view league invites" ON public.private_league_invites;
CREATE POLICY "Members can view league invites"
ON public.private_league_invites
FOR SELECT
TO authenticated
USING (public.is_private_league_member(league_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage league invites" ON public.private_league_invites;
CREATE POLICY "Owners can manage league invites"
ON public.private_league_invites
FOR ALL
TO authenticated
USING (public.is_private_league_owner(league_id, auth.uid()))
WITH CHECK (public.is_private_league_owner(league_id, auth.uid()));

CREATE OR REPLACE TRIGGER update_private_leagues_updated_at
BEFORE UPDATE ON public.private_leagues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_private_league_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Invite expiry must be in the future';
  END IF;
  IF NEW.max_uses IS NOT NULL AND NEW.max_uses <= 0 THEN
    RAISE EXCEPTION 'Invite max uses must be positive';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_private_league_invite_trigger ON public.private_league_invites;
CREATE TRIGGER validate_private_league_invite_trigger
BEFORE INSERT OR UPDATE ON public.private_league_invites
FOR EACH ROW
EXECUTE FUNCTION public.validate_private_league_invite();

CREATE OR REPLACE FUNCTION public.create_private_league_with_invite(name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text;
  v_slug text;
  v_league_id uuid;
  v_token text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_name := left(nullif(btrim(name), ''), 80);
  IF v_name IS NULL THEN
    v_name := 'Spider League Pod';
  END IF;

  v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN
    v_slug := 'spider-league-pod';
  END IF;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_token := encode(public.gen_random_bytes(18), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  INSERT INTO public.private_leagues (owner_id, name, slug)
  VALUES (v_user_id, v_name, v_slug)
  RETURNING id INTO v_league_id;

  INSERT INTO public.private_league_members (league_id, user_id, role)
  VALUES (v_league_id, v_user_id, 'owner')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  INSERT INTO public.private_league_invites (league_id, token, created_by)
  VALUES (v_league_id, v_token, v_user_id);

  RETURN jsonb_build_object(
    'league_id', v_league_id,
    'name', v_name,
    'slug', v_slug,
    'invite_token', v_token,
    'invite_url', 'https://spiderleague.app/join/' || v_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_private_league_invite_preview(token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_creator_name text;
  v_member_count int;
  v_recent_activity jsonb;
BEGIN
  SELECT i.*, l.name, l.is_active, l.owner_id
  INTO v_invite
  FROM public.private_league_invites i
  JOIN public.private_leagues l ON l.id = i.league_id
  WHERE i.token = get_private_league_invite_preview.token
    AND i.is_active = true
    AND l.is_active = true
    AND (i.expires_at IS NULL OR i.expires_at > now())
    AND (i.max_uses IS NULL OR i.use_count < i.max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This league invite is no longer available.');
  END IF;

  SELECT COALESCE(display_name, 'A Spider League player') INTO v_creator_name
  FROM public.profiles
  WHERE id = v_invite.owner_id;

  SELECT count(*) INTO v_member_count
  FROM public.private_league_members
  WHERE league_id = v_invite.league_id;

  SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'created_at') DESC), '[]'::jsonb)
  INTO v_recent_activity
  FROM (
    SELECT jsonb_build_object(
      'id', b.id,
      'created_at', b.created_at,
      'winner', b.winner,
      'spider_a', b.team_a->'spider'->>'nickname',
      'spider_b', b.team_b->'spider'->>'nickname'
    ) AS item
    FROM public.battles b
    WHERE b.league_id = v_invite.league_id
      AND b.is_active = false
    ORDER BY b.created_at DESC
    LIMIT 3
  ) recent;

  RETURN jsonb_build_object(
    'valid', true,
    'league_id', v_invite.league_id,
    'league_name', v_invite.name,
    'creator_name', v_creator_name,
    'member_count', v_member_count,
    'recent_activity', COALESCE(v_recent_activity, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_private_league_invite(token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invite RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT i.*, l.name
  INTO v_invite
  FROM public.private_league_invites i
  JOIN public.private_leagues l ON l.id = i.league_id
  WHERE i.token = claim_private_league_invite.token
    AND i.is_active = true
    AND l.is_active = true
    AND (i.expires_at IS NULL OR i.expires_at > now())
    AND (i.max_uses IS NULL OR i.use_count < i.max_uses)
  FOR UPDATE OF i;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'This league invite is no longer available.');
  END IF;

  INSERT INTO public.private_league_members (league_id, user_id, role)
  VALUES (v_invite.league_id, v_user_id, 'member')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  UPDATE public.private_league_invites
  SET use_count = use_count + 1
  WHERE id = v_invite.id
    AND NOT EXISTS (
      SELECT 1 FROM public.private_league_members
      WHERE league_id = v_invite.league_id
        AND user_id = v_user_id
        AND joined_at < now() - interval '1 second'
    );

  RETURN jsonb_build_object(
    'success', true,
    'league_id', v_invite.league_id,
    'league_name', v_invite.name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_private_league_standings(league_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  wins integer,
  losses integer,
  battles integer,
  win_rate numeric,
  top_spider jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR NOT public.is_private_league_member(league_id, v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH members AS (
    SELECT m.user_id, p.display_name, p.avatar_url
    FROM public.private_league_members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.league_id = get_private_league_standings.league_id
  ), battle_rows AS (
    SELECT
      (b.team_a->>'userId')::uuid AS a_user,
      (b.team_b->>'userId')::uuid AS b_user,
      CASE WHEN b.winner = 'A' THEN (b.team_a->>'userId')::uuid WHEN b.winner = 'B' THEN (b.team_b->>'userId')::uuid ELSE NULL END AS winner_user,
      CASE WHEN b.winner = 'A' THEN (b.team_b->>'userId')::uuid WHEN b.winner = 'B' THEN (b.team_a->>'userId')::uuid ELSE NULL END AS loser_user
    FROM public.battles b
    WHERE b.league_id = get_private_league_standings.league_id
      AND b.is_active = false
  )
  SELECT
    m.user_id,
    m.display_name,
    m.avatar_url,
    COALESCE(count(*) FILTER (WHERE br.winner_user = m.user_id), 0)::integer AS wins,
    COALESCE(count(*) FILTER (WHERE br.loser_user = m.user_id), 0)::integer AS losses,
    COALESCE(count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id), 0)::integer AS battles,
    CASE WHEN count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id) = 0 THEN 0
      ELSE round((count(*) FILTER (WHERE br.winner_user = m.user_id))::numeric * 100 / (count(*) FILTER (WHERE br.a_user = m.user_id OR br.b_user = m.user_id))::numeric, 1)
    END AS win_rate,
    COALESCE((
      SELECT jsonb_build_object('id', s.id, 'nickname', s.nickname, 'species', s.species, 'image_url', s.image_url, 'power_score', s.power_score)
      FROM public.spiders s
      WHERE s.owner_id = m.user_id AND s.is_approved = true
      ORDER BY s.power_score DESC
      LIMIT 1
    ), '{}'::jsonb) AS top_spider
  FROM members m
  LEFT JOIN battle_rows br ON br.a_user = m.user_id OR br.b_user = m.user_id
  GROUP BY m.user_id, m.display_name, m.avatar_url
  ORDER BY wins DESC, win_rate DESC, battles DESC;
END;
$$;