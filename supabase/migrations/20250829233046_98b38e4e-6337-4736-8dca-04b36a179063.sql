-- Update spiders.owner_id foreign key to reference profiles for PostgREST embedding
-- 1) Drop existing FK to auth.users
ALTER TABLE public.spiders DROP CONSTRAINT IF EXISTS spiders_owner_id_fkey;

-- 2) Create FK to profiles(id)
ALTER TABLE public.spiders
ADD CONSTRAINT spiders_owner_id_fkey
FOREIGN KEY (owner_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 3) Ensure index on owner_id for performance
CREATE INDEX IF NOT EXISTS idx_spiders_owner_id ON public.spiders(owner_id);