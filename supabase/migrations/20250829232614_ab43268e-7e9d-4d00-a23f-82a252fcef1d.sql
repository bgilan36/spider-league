-- Sanitize display_name in profiles to prevent email exposure
-- 1) Create trigger function
CREATE OR REPLACE FUNCTION public.sanitize_profile_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If display_name is null, nothing to do
  IF NEW.display_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- If display_name looks like an email, strip domain to avoid exposing the email
  IF NEW.display_name ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    NEW.display_name := split_part(NEW.display_name, '@', 1);
  END IF;

  -- Trim surrounding whitespace
  NEW.display_name := btrim(NEW.display_name);

  -- Optional: limit length to a reasonable value
  IF length(NEW.display_name) > 50 THEN
    NEW.display_name := left(NEW.display_name, 50);
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Attach trigger to profiles
DROP TRIGGER IF EXISTS sanitize_profile_display_name_trigger ON public.profiles;
CREATE TRIGGER sanitize_profile_display_name_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_profile_display_name();

-- 3) Backfill existing rows to remove emails from display_name
UPDATE public.profiles
SET display_name = split_part(display_name, '@', 1)
WHERE display_name ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';