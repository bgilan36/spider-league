CREATE INDEX IF NOT EXISTS idx_battles_league_id_created_at ON public.battles(league_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_most_active_pods(limit_count integer DEFAULT 10)
RETURNS TABLE (
  league_id uuid,
  name text,
  slug text,
  image_url text,
  member_count bigint,
  battle_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pl.id AS league_id,
    pl.name,
    pl.slug,
    pl.image_url,
    (SELECT COUNT(*) FROM public.private_league_members WHERE league_id = pl.id)::bigint AS member_count,
    (SELECT COUNT(*) FROM public.battles WHERE league_id = pl.id AND created_at > now() - interval '7 days')::bigint AS battle_count
  FROM public.private_leagues pl
  WHERE pl.is_active = true
  ORDER BY battle_count DESC, member_count DESC, pl.created_at DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_most_active_pods(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_most_active_pods(integer) TO anon;