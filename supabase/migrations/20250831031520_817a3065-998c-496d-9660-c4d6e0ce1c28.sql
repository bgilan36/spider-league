-- Add email communications preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN email_communications_enabled boolean NOT NULL DEFAULT true;

-- Add index for faster queries when filtering by email preferences
CREATE INDEX idx_profiles_email_communications ON public.profiles(email_communications_enabled) WHERE email_communications_enabled = true;