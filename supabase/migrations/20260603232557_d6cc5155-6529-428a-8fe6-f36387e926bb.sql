
-- Backfill latitude/longitude for bgilan's spiders that have no location yet.
-- Centers: a few well-known clusters with random jitter so the heat map shows hotspots.
WITH targets AS (
  SELECT id,
         row_number() OVER (ORDER BY created_at) AS rn
  FROM public.spiders
  WHERE owner_id = 'cbefeb8c-4a0c-4b62-9226-6d3d0aa4cafd'
    AND (latitude IS NULL OR longitude IS NULL)
),
centers AS (
  SELECT 0 AS idx, 37.7749 AS lat, -122.4194 AS lng -- San Francisco
  UNION ALL SELECT 1, 37.8044, -122.2712             -- Oakland
  UNION ALL SELECT 2, 37.3382, -121.8863             -- San Jose
  UNION ALL SELECT 3, 37.4419, -122.1430             -- Palo Alto
),
assigned AS (
  SELECT t.id,
         c.lat + ((random() - 0.5) * 0.18) AS new_lat,
         c.lng + ((random() - 0.5) * 0.22) AS new_lng
  FROM targets t
  JOIN centers c ON c.idx = (t.rn - 1) % 4
)
UPDATE public.spiders s
SET latitude = a.new_lat,
    longitude = a.new_lng,
    location_name = COALESCE(s.location_name, 'San Francisco Bay Area')
FROM assigned a
WHERE s.id = a.id;
