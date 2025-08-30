-- Add missing foreign key constraints for battle_challenges table
ALTER TABLE public.battle_challenges 
ADD CONSTRAINT battle_challenges_challenger_spider_id_fkey 
FOREIGN KEY (challenger_spider_id) REFERENCES public.spiders(id);

ALTER TABLE public.battle_challenges 
ADD CONSTRAINT battle_challenges_accepter_spider_id_fkey 
FOREIGN KEY (accepter_spider_id) REFERENCES public.spiders(id);

ALTER TABLE public.battle_challenges 
ADD CONSTRAINT battle_challenges_challenger_id_fkey 
FOREIGN KEY (challenger_id) REFERENCES auth.users(id);

ALTER TABLE public.battle_challenges 
ADD CONSTRAINT battle_challenges_accepter_id_fkey 
FOREIGN KEY (accepter_id) REFERENCES auth.users(id);

ALTER TABLE public.battle_challenges 
ADD CONSTRAINT battle_challenges_winner_id_fkey 
FOREIGN KEY (winner_id) REFERENCES auth.users(id);

ALTER TABLE public.battle_challenges 
ADD CONSTRAINT battle_challenges_loser_spider_id_fkey 
FOREIGN KEY (loser_spider_id) REFERENCES public.spiders(id);