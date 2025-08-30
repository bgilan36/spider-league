-- Add missing foreign keys so PostgREST can resolve relationships used in selects
DO $$
BEGIN
  -- challenger -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battle_challenges_challenger_id_fkey'
  ) THEN
    ALTER TABLE public.battle_challenges
    ADD CONSTRAINT battle_challenges_challenger_id_fkey
    FOREIGN KEY (challenger_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
  END IF;

  -- challenger_spider -> spiders
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battle_challenges_challenger_spider_id_fkey'
  ) THEN
    ALTER TABLE public.battle_challenges
    ADD CONSTRAINT battle_challenges_challenger_spider_id_fkey
    FOREIGN KEY (challenger_spider_id)
    REFERENCES public.spiders(id)
    ON DELETE CASCADE;
  END IF;

  -- accepter -> profiles (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battle_challenges_accepter_id_fkey'
  ) THEN
    ALTER TABLE public.battle_challenges
    ADD CONSTRAINT battle_challenges_accepter_id_fkey
    FOREIGN KEY (accepter_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;

  -- accepter_spider -> spiders (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battle_challenges_accepter_spider_id_fkey'
  ) THEN
    ALTER TABLE public.battle_challenges
    ADD CONSTRAINT battle_challenges_accepter_spider_id_fkey
    FOREIGN KEY (accepter_spider_id)
    REFERENCES public.spiders(id)
    ON DELETE SET NULL;
  END IF;

  -- winner -> profiles (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battle_challenges_winner_id_fkey'
  ) THEN
    ALTER TABLE public.battle_challenges
    ADD CONSTRAINT battle_challenges_winner_id_fkey
    FOREIGN KEY (winner_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;

  -- loser_spider -> spiders (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battle_challenges_loser_spider_id_fkey'
  ) THEN
    ALTER TABLE public.battle_challenges
    ADD CONSTRAINT battle_challenges_loser_spider_id_fkey
    FOREIGN KEY (loser_spider_id)
    REFERENCES public.spiders(id)
    ON DELETE SET NULL;
  END IF;

  -- battle reference (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'battle_challenges_battle_id_fkey'
  ) THEN
    ALTER TABLE public.battle_challenges
    ADD CONSTRAINT battle_challenges_battle_id_fkey
    FOREIGN KEY (battle_id)
    REFERENCES public.battles(id)
    ON DELETE SET NULL;
  END IF;
END
$$;

-- Helpful indexes for joins/filters
CREATE INDEX IF NOT EXISTS idx_battle_challenges_challenger_id ON public.battle_challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_battle_challenges_challenger_spider_id ON public.battle_challenges(challenger_spider_id);
CREATE INDEX IF NOT EXISTS idx_battle_challenges_accepter_id ON public.battle_challenges(accepter_id);
CREATE INDEX IF NOT EXISTS idx_battle_challenges_accepter_spider_id ON public.battle_challenges(accepter_spider_id);
CREATE INDEX IF NOT EXISTS idx_battle_challenges_winner_id ON public.battle_challenges(winner_id);
CREATE INDEX IF NOT EXISTS idx_battle_challenges_loser_spider_id ON public.battle_challenges(loser_spider_id);
CREATE INDEX IF NOT EXISTS idx_battle_challenges_battle_id ON public.battle_challenges(battle_id);