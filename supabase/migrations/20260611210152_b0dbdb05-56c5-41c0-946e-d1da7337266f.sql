CREATE OR REPLACE FUNCTION public.generate_pod_invite(p_league_id uuid, p_deactivate_others boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_token text;
  v_league_name text;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Must be the pod owner
  IF NOT public.is_private_league_owner(p_league_id, v_user_id) THEN
    RAISE EXCEPTION 'Forbidden: only the pod owner can generate invites';
  END IF;

  -- Verify league exists and is active
  SELECT name INTO v_league_name
  FROM public.private_leagues
  WHERE id = p_league_id AND is_active = true;

  IF v_league_name IS NULL THEN
    RAISE EXCEPTION 'Pod not found or inactive';
  END IF;

  -- Deactivate existing invites for this pod if requested
  IF p_deactivate_others THEN
    UPDATE public.private_league_invites
    SET is_active = false
    WHERE league_id = p_league_id AND is_active = true;
  END IF;

  -- Generate a new secure token (URL-safe base64 of 18 random bytes)
  v_token := encode(public.gen_random_bytes(18), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  -- Insert the new invite
  INSERT INTO public.private_league_invites (league_id, token, created_by, is_active)
  VALUES (p_league_id, v_token, v_user_id, true);

  RETURN jsonb_build_object(
    'token', v_token,
    'invite_url', 'https://spiderleague.app/join/' || v_token
  );
END;
$$;