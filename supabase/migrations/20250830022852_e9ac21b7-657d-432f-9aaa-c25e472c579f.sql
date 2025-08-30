-- Create storage policies for avatar uploads
-- Allow users to upload their own avatars
CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'spiders' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own avatars
CREATE POLICY "Users can view their own avatar" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'spiders' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own avatars
CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'spiders' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'spiders' AND auth.uid()::text = (storage.foldername(name))[1]);