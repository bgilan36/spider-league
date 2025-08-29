-- Create foreign key relationships required for PostgREST nested selects used by the Leaderboard
-- Using NOT VALID to avoid failing on any legacy rows while enabling relationships for the schema cache

-- 1) spiders.owner_id -> profiles.id (for spiders -> profiles relationship)
ALTER TABLE public.spiders
ADD CONSTRAINT IF NOT EXISTS spiders_owner_id_fkey
FOREIGN KEY (owner_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE
NOT VALID;

CREATE INDEX IF NOT EXISTS idx_spiders_owner_id ON public.spiders(owner_id);

-- 2) weekly_rankings.spider_id -> spiders.id (for weekly_rankings -> spiders relationship)
ALTER TABLE public.weekly_rankings
ADD CONSTRAINT IF NOT EXISTS weekly_rankings_spider_id_fkey
FOREIGN KEY (spider_id)
REFERENCES public.spiders(id)
ON DELETE CASCADE
NOT VALID;

CREATE INDEX IF NOT EXISTS idx_weekly_rankings_spider_id ON public.weekly_rankings(spider_id);

-- 3) weekly_rankings.week_id -> weeks.id (for weekly_rankings -> weeks relationship)
ALTER TABLE public.weekly_rankings
ADD CONSTRAINT IF NOT EXISTS weekly_rankings_week_id_fkey
FOREIGN KEY (week_id)
REFERENCES public.weeks(id)
ON DELETE CASCADE
NOT VALID;

CREATE INDEX IF NOT EXISTS idx_weekly_rankings_week_id ON public.weekly_rankings(week_id);
