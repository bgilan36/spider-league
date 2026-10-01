ALTER TABLE public.battle_challenges DROP CONSTRAINT battle_challenges_status_check;
ALTER TABLE public.battle_challenges ADD CONSTRAINT battle_challenges_status_check
  CHECK (status = ANY (ARRAY['OPEN','ACCEPTED','COMPLETED','CANCELLED','DECLINED','EXPIRED']));