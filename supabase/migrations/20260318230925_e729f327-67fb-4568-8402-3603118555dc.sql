CREATE OR REPLACE FUNCTION public.gen_random_bytes(length integer)
RETURNS bytea
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT extensions.gen_random_bytes(length);
$$;

GRANT EXECUTE ON FUNCTION public.gen_random_bytes(integer) TO anon, authenticated, service_role;