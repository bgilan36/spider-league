CREATE OR REPLACE FUNCTION public.get_species_id_config()
RETURNS TABLE(min_confidence int, min_margin int, escalation_enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT min_confidence, min_margin, escalation_enabled FROM public.species_id_config WHERE id = 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_species_id_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_species_id_config() TO authenticated;