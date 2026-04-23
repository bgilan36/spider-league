
CREATE OR REPLACE FUNCTION public.get_private_league_invite_preview(token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
  v_creator_name text;
  v_member_count int;
  v_battle_count int;
  v_recent_activity jsonb;
  v_members jsonb;
BEGIN
  SELECT i.*, l.name, l.is_active, l.owner_id, l.created_at AS league_created_at
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

  SELECT count(*) INTO v_battle_count
  FROM public.battles
  WHERE league_id = v_invite.league_id AND is_active = false;

  -- Members with their top spider (highest power_score, approved)
  SELECT COALESCE(jsonb_agg(member_obj ORDER BY (member_obj->>'joined_at')), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT jsonb_build_object(
      'user_id', m.user_id,
      'display_name', COALESCE(p.display_name, 'Spider League player'),
      'avatar_url', p.avatar_url,
      'role', m.role,
      'joined_at', m.joined_at,
      'is_owner', (m.user_id = v_invite.owner_id),
      'top_spider', (
        SELECT jsonb_build_object(
          'id', s.id,
          'nickname', s.nickname,
          'image_url', s.image_url,
          'power_score', s.power_score,
          'rarity', s.rarity,
          'level', s.level
        )
        FROM public.spiders s
        WHERE s.owner_id = m.user_id
          AND s.is_approved = true
        ORDER BY s.power_score DESC
        LIMIT 1
      )
    ) AS member_obj
    FROM public.private_league_members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.league_id = v_invite.league_id
    LIMIT 20
  ) members;

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
    LIMIT 5
  ) recent;

  RETURN jsonb_build_object(
    'valid', true,
    'league_id', v_invite.league_id,
    'league_name', v_invite.name,
    'creator_name', v_creator_name,
    'member_count', v_member_count,
    'battle_count', v_battle_count,
    'created_at', v_invite.league_created_at,
    'members', COALESCE(v_members, '[]'::jsonb),
    'recent_activity', COALESCE(v_recent_activity, '[]'::jsonb)
  );
END;
$function$;
