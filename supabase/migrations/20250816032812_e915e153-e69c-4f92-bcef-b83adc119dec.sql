-- Create storage bucket for spider images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('spiders', 'spiders', true);

-- Create storage policies for spider images
CREATE POLICY "Spider images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'spiders');

CREATE POLICY "Users can upload spider images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'spiders' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own spider images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'spiders' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own spider images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'spiders' AND auth.uid()::text = (storage.foldername(name))[1]);