-- Create profile_settings table for sensitive personal data
CREATE TABLE IF NOT EXISTS public.profile_settings (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_communications_enabled boolean NOT NULL DEFAULT true,
  google_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on profile_settings
ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;

-- Users can only view their own settings
CREATE POLICY "Users can view their own settings"
ON public.profile_settings
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can insert their own settings
CREATE POLICY "Users can insert their own settings"
ON public.profile_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can update their own settings
CREATE POLICY "Users can update their own settings"
ON public.profile_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Migrate existing data from profiles to profile_settings
INSERT INTO public.profile_settings (id, email_communications_enabled, google_id)
SELECT id, email_communications_enabled, google_id
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- Drop sensitive columns from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email_communications_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS google_id;

-- Add trigger to keep profile_settings updated_at in sync
CREATE TRIGGER update_profile_settings_updated_at
BEFORE UPDATE ON public.profile_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();