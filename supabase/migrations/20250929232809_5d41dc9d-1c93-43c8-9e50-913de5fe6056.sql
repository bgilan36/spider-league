-- Step 1: Drop the problematic updated_at trigger
DROP TRIGGER IF EXISTS update_battle_challenges_updated_at ON public.battle_challenges;

-- Step 2: Temporarily disable the expiry validation trigger
ALTER TABLE public.battle_challenges DISABLE TRIGGER validate_challenge_expiry_trigger;

-- Step 3: Cancel duplicate open challenges, keeping only the most recent one per spider
UPDATE public.battle_challenges
SET status = 'CANCELLED'
WHERE id IN (
  SELECT bc.id
  FROM public.battle_challenges bc
  INNER JOIN (
    SELECT challenger_spider_id, MAX(created_at) as max_created_at
    FROM public.battle_challenges
    WHERE status = 'OPEN'
    GROUP BY challenger_spider_id
    HAVING COUNT(*) > 1
  ) dupes ON bc.challenger_spider_id = dupes.challenger_spider_id
  WHERE bc.status = 'OPEN'
    AND bc.created_at < dupes.max_created_at
);

-- Step 4: Re-enable the expiry validation trigger
ALTER TABLE public.battle_challenges ENABLE TRIGGER validate_challenge_expiry_trigger;

-- Step 5: Create unique partial index (without now() function which isn't immutable)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_challenge_per_spider 
ON public.battle_challenges (challenger_spider_id) 
WHERE status = 'OPEN';