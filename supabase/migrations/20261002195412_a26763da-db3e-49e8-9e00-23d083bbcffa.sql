DROP POLICY IF EXISTS "Demo spiders visible only to owner" ON public.spiders;
CREATE POLICY "Demo spiders visible only to owner" ON public.spiders AS RESTRICTIVE FOR SELECT
USING ((owner_id = auth.uid()) OR (NOT public.is_demo_user(owner_id)) OR public.is_demo_user(auth.uid()));