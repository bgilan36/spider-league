CREATE TABLE public.species_id_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_confidence int NOT NULL DEFAULT 70 CHECK (min_confidence BETWEEN 0 AND 100),
  min_margin int NOT NULL DEFAULT 10 CHECK (min_margin BETWEEN 0 AND 100),
  escalation_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.species_id_config TO authenticated;
GRANT ALL ON public.species_id_config TO service_role;
ALTER TABLE public.species_id_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read config" ON public.species_id_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update config" ON public.species_id_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.species_id_config (id) VALUES (1);

CREATE TABLE public.species_id_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  predicted_species text NOT NULL,
  predicted_confidence int,
  tier_used text,
  candidates jsonb,
  confirmed_species text NOT NULL,
  is_correct boolean NOT NULL,
  note text CHECK (char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.species_id_feedback TO authenticated;
GRANT ALL ON public.species_id_feedback TO service_role;
ALTER TABLE public.species_id_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own feedback" ON public.species_id_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own or admin all" ON public.species_id_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));