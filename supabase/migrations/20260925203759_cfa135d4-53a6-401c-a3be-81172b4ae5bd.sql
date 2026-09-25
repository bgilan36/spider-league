CREATE TABLE public.spider_species (
  slug text PRIMARY KEY,
  common_name text NOT NULL,
  scientific_name text NOT NULL UNIQUE,
  family text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  habitat text NOT NULL,
  us_range text NOT NULL,
  size_min_mm numeric NOT NULL,
  size_max_mm numeric NOT NULL,
  danger text NOT NULL DEFAULT 'minimal',
  venom_potency integer NOT NULL DEFAULT 20,
  web_builder boolean NOT NULL DEFAULT false,
  speed_type text NOT NULL DEFAULT 'moderate',
  is_native boolean NOT NULL DEFAULT true,
  diagnostic_features text NOT NULL,
  harmful_reason text,
  special_abilities text[] NOT NULL DEFAULT '{}',
  base_stats jsonb NOT NULL,
  image_url text,
  image_credit text,
  wikipedia_url text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spider_species TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.spider_species TO authenticated;
GRANT ALL ON public.spider_species TO service_role;
ALTER TABLE public.spider_species ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read species" ON public.spider_species FOR SELECT USING (true);
CREATE POLICY "Admins manage species" ON public.spider_species FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX spider_species_sci_lower ON public.spider_species (lower(scientific_name));
CREATE TRIGGER update_spider_species_updated_at BEFORE UPDATE ON public.spider_species
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();