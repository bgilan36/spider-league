
-- 1. Opt-in column
ALTER TABLE public.profile_settings
  ADD COLUMN IF NOT EXISTS share_spider_locations boolean NOT NULL DEFAULT false;

-- 2. Auto opt-in bgilan (owner explicitly backfilled their locations)
INSERT INTO public.profile_settings (id, share_spider_locations)
VALUES ('cbefeb8c-4a0c-4b62-9226-6d3d0aa4cafd', true)
ON CONFLICT (id) DO UPDATE SET share_spider_locations = true;

-- 3. Privacy-respecting heatmap RPC
CREATE OR REPLACE FUNCTION public.get_spider_upload_heatmap(days_back integer DEFAULT NULL)
RETURNS TABLE (latitude double precision, longitude double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.latitude, s.longitude
  FROM public.spiders s
  JOIN public.profile_settings ps ON ps.id = s.owner_id
  WHERE s.is_approved = true
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND ps.share_spider_locations = true
    AND (days_back IS NULL OR s.created_at >= now() - make_interval(days => days_back))
  LIMIT 5000;
$$;

REVOKE ALL ON FUNCTION public.get_spider_upload_heatmap(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_spider_upload_heatmap(integer) TO authenticated;
