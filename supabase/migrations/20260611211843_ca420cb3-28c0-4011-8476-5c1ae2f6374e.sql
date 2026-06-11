
-- 1. Discoverable flag
ALTER TABLE public.private_leagues
  ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT true;

-- 2. Public-ish SELECT policy for discoverable pods (signed-in users only)
DROP POLICY IF EXISTS "Authenticated can view discoverable pods" ON public.private_leagues;
CREATE POLICY "Authenticated can view discoverable pods"
  ON public.private_leagues
  FOR SELECT
  TO authenticated
  USING (is_active = true AND is_discoverable = true);

-- 3. Join requests table
CREATE TABLE IF NOT EXISTS public.private_league_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.private_leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responded_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS private_league_join_requests_one_pending
  ON public.private_league_join_requests(league_id, user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS private_league_join_requests_league_idx
  ON public.private_league_join_requests(league_id, status);

GRANT SELECT, INSERT, UPDATE ON public.private_league_join_requests TO authenticated;
GRANT ALL ON public.private_league_join_requests TO service_role;

ALTER TABLE public.private_league_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own requests"
  ON public.private_league_join_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners see requests for their pods"
  ON public.private_league_join_requests
  FOR SELECT TO authenticated
  USING (public.is_private_league_owner(league_id, auth.uid()));

CREATE TRIGGER private_league_join_requests_updated_at
  BEFORE UPDATE ON public.private_league_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RPC: request to join
CREATE OR REPLACE FUNCTION public.request_to_join_pod(p_league_id uuid, p_message text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_request_id uuid;
  v_pod RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, name, is_active, is_discoverable INTO v_pod
  FROM public.private_leagues WHERE id = p_league_id;

  IF NOT FOUND OR NOT v_pod.is_active THEN
    RAISE EXCEPTION 'Pod not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.private_league_members WHERE league_id = p_league_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'You are already a member of this pod';
  END IF;

  IF EXISTS (SELECT 1 FROM public.private_league_join_requests WHERE league_id = p_league_id AND user_id = v_user AND status = 'pending') THEN
    RAISE EXCEPTION 'You already have a pending request for this pod';
  END IF;

  INSERT INTO public.private_league_join_requests (league_id, user_id, message)
  VALUES (p_league_id, v_user, NULLIF(btrim(coalesce(p_message,'')), ''))
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('request_id', v_request_id, 'status', 'pending');
END;
$$;

-- 5. RPC: respond (owner only)
CREATE OR REPLACE FUNCTION public.respond_to_join_request(p_request_id uuid, p_approve boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_req RECORD;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT r.*, l.owner_id AS pod_owner
  INTO v_req
  FROM public.private_league_join_requests r
  JOIN public.private_leagues l ON l.id = r.league_id
  WHERE r.id = p_request_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.pod_owner <> v_owner THEN RAISE EXCEPTION 'Only the pod owner can respond'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already %', v_req.status; END IF;

  IF p_approve THEN
    INSERT INTO public.private_league_members (league_id, user_id, role)
    VALUES (v_req.league_id, v_req.user_id, 'member')
    ON CONFLICT DO NOTHING;
    UPDATE public.private_league_join_requests
      SET status = 'approved', responded_at = now(), responded_by = v_owner
      WHERE id = p_request_id;
  ELSE
    UPDATE public.private_league_join_requests
      SET status = 'rejected', responded_at = now(), responded_by = v_owner
      WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$$;

-- 6. RPC: cancel own request
CREATE OR REPLACE FUNCTION public.cancel_join_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.private_league_join_requests
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_request_id AND user_id = v_user AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending request to cancel'; END IF;
  RETURN jsonb_build_object('status','cancelled');
END;
$$;

-- 7. RPC: list discoverable pods with member counts and current user's status
CREATE OR REPLACE FUNCTION public.list_discoverable_pods()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  image_url text,
  created_at timestamptz,
  member_count bigint,
  is_member boolean,
  has_pending_request boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.name,
    l.slug,
    l.image_url,
    l.created_at,
    (SELECT count(*) FROM public.private_league_members m WHERE m.league_id = l.id) AS member_count,
    EXISTS (SELECT 1 FROM public.private_league_members m WHERE m.league_id = l.id AND m.user_id = auth.uid()) AS is_member,
    EXISTS (SELECT 1 FROM public.private_league_join_requests r WHERE r.league_id = l.id AND r.user_id = auth.uid() AND r.status = 'pending') AS has_pending_request
  FROM public.private_leagues l
  WHERE l.is_active = true AND l.is_discoverable = true
  ORDER BY l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.request_to_join_pod(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_join_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_discoverable_pods() TO authenticated;
