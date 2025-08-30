-- Update species bias function with evidence-informed rules and recalculate all spiders
-- Source-informed: BBC Science Focus (Top 10 most venomous spiders) and SpiderSpotter species pages

-- 1) Update function with explicit search_path
CREATE OR REPLACE FUNCTION public.apply_species_bias(
  species text,
  in_hit_points integer,
  in_damage integer,
  in_speed integer,
  in_defense integer,
  in_venom integer,
  in_webcraft integer
)
RETURNS TABLE(hit_points integer, damage integer, speed integer, defense integer, venom integer, webcraft integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Specific high-risk species first
  IF s LIKE '%funnel%' OR s LIKE '%funnel-web%' OR s LIKE '%atrax%' OR s LIKE '%hadronyche%' THEN
    -- Sydney funnel-web and relatives: extremely venomous, fast, robust, web builders
    venom := 100;
    damage := GREATEST(damage, 85);
    speed := GREATEST(speed, 80);
    defense := GREATEST(defense, 80);
    hit_points := GREATEST(hit_points, 75);
    webcraft := GREATEST(webcraft, 70);
  ELSIF (s LIKE '%phoneutria%' OR s LIKE '%wandering%') OR (s LIKE '%banana%' AND s NOT LIKE '%orb%' AND s NOT LIKE '%nephila%') THEN
    -- Brazilian wandering spider (Phoneutria): highly venomous, aggressive, very fast, low web use
    venom := GREATEST(venom, 98);
    damage := GREATEST(damage, 85);
    speed := GREATEST(speed, 90);
    defense := GREATEST(defense, 65);
    hit_points := GREATEST(hit_points, 70);
    webcraft := LEAST(webcraft, 40);
  ELSIF s LIKE '%sicarius%' OR (s LIKE '%six%' AND s LIKE '%eye%' AND s LIKE '%sand%') THEN
    -- Six-eyed sand spider (Sicarius): very potent venom, armored ambusher, low web use, slower
    venom := GREATEST(venom, 97);
    damage := GREATEST(damage, 70);
    speed := LEAST(speed, 55);
    defense := GREATEST(defense, 80);
    hit_points := GREATEST(hit_points, 65);
    webcraft := LEAST(webcraft, 30);
  ELSIF s LIKE '%redback%' OR s LIKE '%hasselti%' THEN
    -- Australian redback (Latrodectus hasselti): widow-type
    venom := GREATEST(venom, 97);
    damage := GREATEST(damage, 70);
    speed := LEAST(speed, 60);
    webcraft := LEAST(webcraft, 50);
    hit_points := GREATEST(hit_points, 55);
  ELSIF s LIKE '%missulena%' OR (s LIKE '%mouse%' AND s LIKE '%spider%') THEN
    -- Mouse spiders (Missulena): potent venom, sturdy build
    venom := GREATEST(venom, 92);
    damage := GREATEST(damage, 75);
    speed := GREATEST(speed, 70);
    defense := GREATEST(defense, 70);
    hit_points := GREATEST(hit_points, 65);
    webcraft := LEAST(webcraft, 45);
  ELSIF s LIKE '%widow%' OR s LIKE '%latrodectus%' THEN
    venom := GREATEST(venom, 95);
    damage := GREATEST(damage, 70);
    speed := LEAST(speed, 60);
    webcraft := LEAST(webcraft, 50);
    hit_points := GREATEST(hit_points, 55);
  ELSIF s LIKE '%recluse%' OR s LIKE '%loxosceles%' THEN
    venom := GREATEST(venom, 90);
    damage := GREATEST(damage, 70);
    webcraft := LEAST(webcraft, 50);
  ELSIF s LIKE '%tarantula%' OR s LIKE '%theraphosa%' OR s LIKE '%aphonopelma%' THEN
    hit_points := GREATEST(hit_points, 95);
    defense := GREATEST(defense, 80);
    damage := GREATEST(damage, 80);
    speed := LEAST(speed, 55);
    venom := LEAST(venom, 60);
    webcraft := LEAST(webcraft, 60);
  ELSIF s LIKE '%barn%' OR s LIKE '%orb%' OR s LIKE '%weaver%' OR s LIKE '%garden%' OR s LIKE '%nephila%' OR s LIKE '%golden orb%' OR (s LIKE '%banana%' AND (s LIKE '%orb%' OR s LIKE '%nephila%')) THEN
    -- Orb-weavers: excellent web builders, weak venom
    webcraft := GREATEST(webcraft, 80);
    venom := LEAST(venom, 45);
    damage := LEAST(damage, 65);
    defense := GREATEST(defense, 60);
    hit_points := GREATEST(hit_points, 60);
  ELSIF s LIKE '%wolf%' OR s LIKE '%lycosa%' THEN
    speed := GREATEST(speed, 85);
    damage := GREATEST(damage, 75);
    webcraft := LEAST(webcraft, 40);
    venom := GREATEST(venom, 60);
    hit_points := GREATEST(hit_points, 70);
  ELSIF s LIKE '%jump%' OR s LIKE '%salticidae%' THEN
    speed := GREATEST(speed, 80);
    damage := GREATEST(damage, 65);
    webcraft := LEAST(webcraft, 35);
    hit_points := GREATEST(hit_points, 55);
    defense := GREATEST(defense, 55);
  ELSIF s LIKE '%huntsman%' OR s LIKE '%heteropoda%' THEN
    speed := GREATEST(speed, 90);
    damage := GREATEST(damage, 75);
    hit_points := GREATEST(hit_points, 80);
    webcraft := LEAST(webcraft, 30);
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
$function$;

-- 2) Recompute all spiders using updated bias
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

-- 3) Refresh weekly rankings
SELECT public.update_weekly_rankings();