DROP POLICY IF EXISTS "Users can view public profile information" ON public.profiles;
CREATE POLICY "Users can view public profile information" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (is_demo = false AND public.is_demo_user(auth.uid()) = false)
  OR (is_demo = true AND public.is_demo_user(auth.uid()) = true)
  OR public.has_role(auth.uid(), 'admin')
);