DROP FUNCTION public.get_species_id_config();
DROP POLICY "Admins read config" ON public.species_id_config;
CREATE POLICY "Signed-in users read config" ON public.species_id_config FOR SELECT TO authenticated USING (true);