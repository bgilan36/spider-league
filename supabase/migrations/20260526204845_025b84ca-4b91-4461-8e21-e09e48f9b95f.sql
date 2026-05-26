ALTER TABLE public.spiders
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric;

CREATE INDEX IF NOT EXISTS idx_spiders_lat_lng
  ON public.spiders (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;