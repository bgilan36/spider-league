-- Add image_url column to private leagues
ALTER TABLE public.private_leagues ADD COLUMN IF NOT EXISTS image_url text;

-- Allow any pod member to update the league image (and only image-related fields kept simple via members policy)
CREATE POLICY "Members can update league image"
ON public.private_leagues
FOR UPDATE
TO authenticated
USING (is_private_league_member(id, auth.uid()))
WITH CHECK (is_private_league_member(id, auth.uid()));

-- Storage bucket for pod images (public read so they render in cards)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pod-images', 'pod-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view pod images
CREATE POLICY "Pod images are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'pod-images');

-- Authenticated users can upload to pod-images bucket (path is league_id/...)
CREATE POLICY "Members can upload pod images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pod-images'
  AND public.is_private_league_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Members can update pod images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pod-images'
  AND public.is_private_league_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Members can delete pod images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pod-images'
  AND public.is_private_league_member(((storage.foldername(name))[1])::uuid, auth.uid())
);