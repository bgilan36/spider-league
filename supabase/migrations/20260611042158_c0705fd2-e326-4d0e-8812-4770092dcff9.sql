ALTER TABLE public.spiders ADD COLUMN IF NOT EXISTS share_image_url text;
ALTER TABLE public.battles ADD COLUMN IF NOT EXISTS share_image_url text;
-- Allow public read of completed battles so the og-card edge function (and humans) can fetch them by id without auth
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='battles' AND policyname='Completed battles are publicly viewable') THEN
    CREATE POLICY "Completed battles are publicly viewable" ON public.battles FOR SELECT TO anon USING (is_active = false AND winner IS NOT NULL);
  END IF;
END $$;
GRANT SELECT ON public.battles TO anon;
GRANT SELECT ON public.spiders TO anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='spiders' AND policyname='Approved spiders are publicly viewable') THEN
    CREATE POLICY "Approved spiders are publicly viewable" ON public.spiders FOR SELECT TO anon USING (is_approved = true);
  END IF;
END $$;