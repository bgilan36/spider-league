-- Add pod scoping + idempotency to matchups for the weekly seeder
ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS pod_league_id uuid;

CREATE INDEX IF NOT EXISTS idx_matchups_pod_week
  ON public.matchups(pod_league_id, week_id);

-- Canonicalize pair ordering so (a,b) and (b,a) collide on the unique index
CREATE OR REPLACE FUNCTION public.matchups_canonicalize_pair()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_a_id > NEW.user_b_id THEN
    -- swap
    DECLARE
      tmp_user uuid := NEW.user_a_id;
      tmp_team jsonb := NEW.team_a;
    BEGIN
      NEW.user_a_id := NEW.user_b_id;
      NEW.team_a := NEW.team_b;
      NEW.user_b_id := tmp_user;
      NEW.team_b := tmp_team;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matchups_canonicalize_pair ON public.matchups;
CREATE TRIGGER matchups_canonicalize_pair
  BEFORE INSERT OR UPDATE OF user_a_id, user_b_id ON public.matchups
  FOR EACH ROW EXECUTE FUNCTION public.matchups_canonicalize_pair();

-- Idempotency: one pairing per (week, pod-or-public, ordered pair).
-- Coalesce null pod_league_id to a sentinel so the unique index applies to public matchups too.
CREATE UNIQUE INDEX IF NOT EXISTS uq_matchups_week_pod_pair
  ON public.matchups(
    week_id,
    COALESCE(pod_league_id, '00000000-0000-0000-0000-000000000000'::uuid),
    user_a_id,
    user_b_id
  );