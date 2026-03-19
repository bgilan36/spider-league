
-- Fix search_path on the two immutable helper functions
CREATE OR REPLACE FUNCTION public.calculate_spider_level(spider_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN spider_xp >= 2000 THEN 10
    WHEN spider_xp >= 1500 THEN 9
    WHEN spider_xp >= 1100 THEN 8
    WHEN spider_xp >= 800 THEN 7
    WHEN spider_xp >= 550 THEN 6
    WHEN spider_xp >= 360 THEN 5
    WHEN spider_xp >= 220 THEN 4
    WHEN spider_xp >= 120 THEN 3
    WHEN spider_xp >= 50 THEN 2
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.xp_for_next_level(current_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE current_level
    WHEN 1 THEN 50
    WHEN 2 THEN 120
    WHEN 3 THEN 220
    WHEN 4 THEN 360
    WHEN 5 THEN 550
    WHEN 6 THEN 800
    WHEN 7 THEN 1100
    WHEN 8 THEN 1500
    WHEN 9 THEN 2000
    ELSE 2000
  END;
$$;
