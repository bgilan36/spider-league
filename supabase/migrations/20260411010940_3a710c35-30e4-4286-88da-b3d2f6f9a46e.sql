-- Fix eligible_until: set it to created_at + 30 days for all spiders
-- This means only spiders uploaded in the last 30 days will be active
UPDATE public.spiders
SET eligible_until = created_at + interval '30 days'
WHERE eligible_until IS NOT NULL;