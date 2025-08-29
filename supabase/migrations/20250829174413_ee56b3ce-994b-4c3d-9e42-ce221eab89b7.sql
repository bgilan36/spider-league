-- Establish required relationships for nested selects on Leaderboard

-- 1) spiders.owner_id -> profiles.id
DO $$
BEGIN
  ALTER TABLE public.spiders
    ADD CONSTRAINT spiders_owner_id_fkey
    FOREIGN KEY (owner_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_spiders_owner_id ON public.spiders(owner_id);

-- 2) weekly_rankings.spider_id -> spiders.id
DO $$
BEGIN
  ALTER TABLE public.weekly_rankings
    ADD CONSTRAINT weekly_rankings_spider_id_fkey
    FOREIGN KEY (spider_id)
    REFERENCES public.spiders(id)
    ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_weekly_rankings_spider_id ON public.weekly_rankings(spider_id);

-- 3) weekly_rankings.week_id -> weeks.id
DO $$
BEGIN
  ALTER TABLE public.weekly_rankings
    ADD CONSTRAINT weekly_rankings_week_id_fkey
    FOREIGN KEY (week_id)
    REFERENCES public.weeks(id)
    ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_weekly_rankings_week_id ON public.weekly_rankings(week_id);
