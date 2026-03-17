CREATE OR REPLACE FUNCTION public.get_recent_public_skirmishes(row_limit integer DEFAULT 24)
RETURNS TABLE (
  id uuid,
  created_at timestamp with time zone,
  winner_side text,
  player_spider_snapshot jsonb,
  opponent_spider_snapshot jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  safe_limit := LEAST(GREATEST(COALESCE(row_limit, 24), 1), 50);

  RETURN QUERY
  SELECT
    s.id,
    s.created_at,
    s.winner_side,
    s.player_spider_snapshot,
    s.opponent_spider_snapshot
  FROM public.spider_skirmishes s
  WHERE s.winner_side IS NOT NULL
  ORDER BY s.created_at DESC
  LIMIT safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_recent_public_skirmishes(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_public_skirmishes(integer) TO authenticated;