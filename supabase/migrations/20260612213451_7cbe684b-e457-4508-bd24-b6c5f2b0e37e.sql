
CREATE TABLE IF NOT EXISTS public.rarity_thresholds (
  id INT PRIMARY KEY DEFAULT 1,
  p50 INT NOT NULL,
  p80 INT NOT NULL,
  p93 INT NOT NULL,
  p98 INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

GRANT SELECT ON public.rarity_thresholds TO anon, authenticated;
GRANT ALL ON public.rarity_thresholds TO service_role;

ALTER TABLE public.rarity_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rarity_thresholds readable by all" ON public.rarity_thresholds;
CREATE POLICY "rarity_thresholds readable by all"
  ON public.rarity_thresholds FOR SELECT USING (true);

INSERT INTO public.rarity_thresholds (id, p50, p80, p93, p98)
VALUES (1, 300, 323, 368, 453)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.classify_rarity(p_power INT)
RETURNS public.spider_rarity
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE t public.rarity_thresholds;
BEGIN
  SELECT * INTO t FROM public.rarity_thresholds WHERE id = 1;
  IF p_power IS NULL THEN RETURN 'COMMON'::public.spider_rarity; END IF;
  IF p_power >= t.p98 THEN RETURN 'LEGENDARY'::public.spider_rarity; END IF;
  IF p_power >= t.p93 THEN RETURN 'EPIC'::public.spider_rarity; END IF;
  IF p_power >= t.p80 THEN RETURN 'RARE'::public.spider_rarity; END IF;
  IF p_power >= t.p50 THEN RETURN 'UNCOMMON'::public.spider_rarity; END IF;
  RETURN 'COMMON'::public.spider_rarity;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_spider_rarity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.rarity := public.classify_rarity(NEW.power_score);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_spider_rarity ON public.spiders;
CREATE TRIGGER trg_enforce_spider_rarity
  BEFORE INSERT OR UPDATE OF power_score ON public.spiders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_spider_rarity();

UPDATE public.spiders
SET rarity = public.classify_rarity(power_score)
WHERE rarity IS DISTINCT FROM public.classify_rarity(power_score);

CREATE OR REPLACE FUNCTION public.recompute_rarity_thresholds()
RETURNS public.rarity_thresholds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p50 INT; v_p80 INT; v_p93 INT; v_p98 INT;
  v_row public.rarity_thresholds;
BEGIN
  SELECT
    percentile_disc(0.50) WITHIN GROUP (ORDER BY power_score)::INT,
    percentile_disc(0.80) WITHIN GROUP (ORDER BY power_score)::INT,
    percentile_disc(0.93) WITHIN GROUP (ORDER BY power_score)::INT,
    percentile_disc(0.98) WITHIN GROUP (ORDER BY power_score)::INT
    INTO v_p50, v_p80, v_p93, v_p98
  FROM public.spiders;

  UPDATE public.rarity_thresholds
    SET p50 = COALESCE(v_p50, p50),
        p80 = COALESCE(v_p80, p80),
        p93 = COALESCE(v_p93, p93),
        p98 = COALESCE(v_p98, p98),
        updated_at = now()
    WHERE id = 1
    RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_rarity_distribution()
RETURNS TABLE(rarity TEXT, count BIGINT, percentage NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH totals AS (SELECT COUNT(*)::NUMERIC AS total FROM public.spiders),
  counts AS (
    SELECT s.rarity::TEXT AS rarity, COUNT(*)::BIGINT AS count
    FROM public.spiders s GROUP BY s.rarity
  )
  SELECT v.tier AS rarity,
         COALESCE(c.count, 0) AS count,
         CASE WHEN t.total > 0 THEN ROUND(COALESCE(c.count, 0) * 100.0 / t.total, 1) ELSE 0 END AS percentage
  FROM (VALUES ('COMMON'), ('UNCOMMON'), ('RARE'), ('EPIC'), ('LEGENDARY')) AS v(tier)
  LEFT JOIN counts c ON c.rarity = v.tier
  CROSS JOIN totals t;
$$;

GRANT EXECUTE ON FUNCTION public.get_rarity_distribution() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.classify_rarity(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_rarity_thresholds() TO authenticated;

CREATE OR REPLACE FUNCTION public.announce_legendary_spider()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.rarity = 'LEGENDARY' THEN
    INSERT INTO public.global_chat_messages (user_id, message)
    VALUES (
      NEW.owner_id,
      '🚨 A LEGENDARY spider has entered the league — ' || COALESCE(NEW.nickname, 'Unknown') ||
      ' (' || COALESCE(NEW.species, 'Unknown species') || ') • Power ' || NEW.power_score
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announce_legendary_spider ON public.spiders;
CREATE TRIGGER trg_announce_legendary_spider
  AFTER INSERT ON public.spiders
  FOR EACH ROW EXECUTE FUNCTION public.announce_legendary_spider();
