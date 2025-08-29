-- Apply species-specific stat biases and recalculate power_score/rarity for all spiders
-- 1) Helper function to apply species bias (matches edge/client logic)
CREATE OR REPLACE FUNCTION public.apply_species_bias(
  species TEXT,
  in_hit_points INT,
  in_damage INT,
  in_speed INT,
  in_defense INT,
  in_venom INT,
  in_webcraft INT
) RETURNS TABLE (
  hit_points INT,
  damage INT,
  speed INT,
  defense INT,
  venom INT,
  webcraft INT
) LANGUAGE plpgsql AS $$
DECLARE
  s TEXT;
BEGIN
  s := lower(coalesce(species, ''));

  -- Start with clamped inputs
  hit_points := greatest(10, least(100, coalesce(in_hit_points, 50)));
  damage := greatest(10, least(100, coalesce(in_damage, 50)));
  speed := greatest(10, least(100, coalesce(in_speed, 50)));
  defense := greatest(10, least(100, coalesce(in_defense, 50)));
  venom := greatest(10, least(100, coalesce(in_venom, 50)));
  webcraft := greatest(10, least(100, coalesce(in_webcraft, 50)));

  -- Species rules
  IF s LIKE '%widow%' THEN
    venom := greatest(venom, 95);
    damage := greatest(damage, 70);
    speed := least(speed, 60);
    webcraft := least(webcraft, 50);
    hit_points := greatest(hit_points, 55);
  ELSIF s LIKE '%recluse%' THEN
    venom := greatest(venom, 90);
    damage := greatest(damage, 70);
    webcraft := least(webcraft, 50);
  ELSIF s LIKE '%tarantula%' THEN
    hit_points := greatest(hit_points, 95);
    defense := greatest(defense, 80);
    damage := greatest(damage, 80);
    speed := least(speed, 55);
    venom := least(venom, 60);
    webcraft := least(webcraft, 60);
  ELSIF s LIKE '%barn%' OR s LIKE '%orb%' OR s LIKE '%weaver%' OR s LIKE '%garden%' THEN
    webcraft := greatest(webcraft, 80);
    venom := least(venom, 45);
    damage := least(damage, 65);
    defense := greatest(defense, 60);
    hit_points := greatest(hit_points, 60);
  ELSIF s LIKE '%wolf%' THEN
    speed := greatest(speed, 85);
    damage := greatest(damage, 75);
    webcraft := least(webcraft, 40);
    venom := greatest(venom, 60);
    hit_points := greatest(hit_points, 70);
  ELSIF s LIKE '%jump%' THEN
    speed := greatest(speed, 80);
    damage := greatest(damage, 65);
    webcraft := least(webcraft, 35);
    hit_points := greatest(hit_points, 55);
    defense := greatest(defense, 55);
  ELSIF s LIKE '%huntsman%' THEN
    speed := greatest(speed, 90);
    damage := greatest(damage, 75);
    hit_points := greatest(hit_points, 80);
    webcraft := least(webcraft, 30);
  END IF;

  -- Final clamp and return
  RETURN QUERY SELECT
    greatest(10, least(100, hit_points)),
    greatest(10, least(100, damage)),
    greatest(10, least(100, speed)),
    greatest(10, least(100, defense)),
    greatest(10, least(100, venom)),
    greatest(10, least(100, webcraft));
END;
$$;

-- 2) Update all spiders with biased stats and recompute power_score + rarity
WITH biased AS (
  SELECT
    s.id,
    b.hit_points,
    b.damage,
    b.speed,
    b.defense,
    b.venom,
    b.webcraft
  FROM public.spiders s
  CROSS JOIN LATERAL public.apply_species_bias(
    s.species,
    s.hit_points,
    s.damage,
    s.speed,
    s.defense,
    s.venom,
    s.webcraft
  ) AS b(hit_points, damage, speed, defense, venom, webcraft)
)
UPDATE public.spiders s
SET
  hit_points = b.hit_points,
  damage = b.damage,
  speed = b.speed,
  defense = b.defense,
  venom = b.venom,
  webcraft = b.webcraft,
  power_score = (b.hit_points + b.damage + b.speed + b.defense + b.venom + b.webcraft),
  rarity = CASE
    WHEN (b.hit_points + b.damage + b.speed + b.defense + b.venom + b.webcraft) >= 280 THEN 'LEGENDARY'::spider_rarity
    WHEN (b.hit_points + b.damage + b.speed + b.defense + b.venom + b.webcraft) >= 240 THEN 'EPIC'::spider_rarity
    WHEN (b.hit_points + b.damage + b.speed + b.defense + b.venom + b.webcraft) >= 200 THEN 'RARE'::spider_rarity
    ELSE 'COMMON'::spider_rarity
  END,
  updated_at = now()
FROM biased b
WHERE s.id = b.id;

-- 3) Refresh weekly rankings to reflect new power scores
SELECT public.update_weekly_rankings();