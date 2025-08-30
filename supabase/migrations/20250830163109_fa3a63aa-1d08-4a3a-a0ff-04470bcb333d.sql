-- Phase 1: Restrict profiles SELECT to own profile only
DO $$
BEGIN
  -- Drop overly permissive SELECT policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Profiles are viewable by authenticated users only'
  ) THEN
    DROP POLICY "Profiles are viewable by authenticated users only" ON public.profiles;
  END IF;
END $$;

-- Create strict SELECT policy
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Phase 3: Input sanitization utilities and triggers

-- Utility: plain text sanitizer
CREATE OR REPLACE FUNCTION public.sanitize_plain_text(t text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF t IS NULL THEN RETURN NULL; END IF;
  -- Remove control chars
  t := regexp_replace(t, '[\u0000-\u001F\u007F]', '', 'g');
  -- Strip HTML tags
  t := regexp_replace(t, '<[^>]*>', '', 'g');
  -- Collapse whitespace
  t := regexp_replace(t, '\s+', ' ', 'g');
  -- Trim and limit length
  t := btrim(t);
  IF length(t) > 1000 THEN t := left(t, 1000); END IF;
  RETURN t;
END;
$$;

-- Profiles: attach existing display_name sanitizer via trigger
CREATE OR REPLACE FUNCTION public.trigger_sanitize_profile_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW := public.sanitize_profile_display_name() -- reuse existing logic
          (NEW.*); -- call as trigger-style wrapper is not directly invocable; emulate by reassigning fields
  RETURN NEW;
END;
$$;
-- Above approach isn't valid to call another trigger fn directly; instead, reimplement minimal logic here
DROP FUNCTION IF EXISTS public.trigger_sanitize_profile_display_name();
CREATE OR REPLACE FUNCTION public.trigger_sanitize_profile_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mirror sanitize_profile_display_name behavior
  IF NEW.display_name IS NOT NULL THEN
    IF NEW.display_name ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      NEW.display_name := split_part(NEW.display_name, '@', 1);
    END IF;
    NEW.display_name := btrim(NEW.display_name);
    IF length(NEW.display_name) > 50 THEN
      NEW.display_name := left(NEW.display_name, 50);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Profiles bio sanitizer
CREATE OR REPLACE FUNCTION public.trigger_sanitize_profile_bio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.bio := public.sanitize_plain_text(NEW.bio);
  RETURN NEW;
END;
$$;

-- Posts content sanitizer
CREATE OR REPLACE FUNCTION public.trigger_sanitize_post_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.content := public.sanitize_plain_text(NEW.content);
  RETURN NEW;
END;
$$;

-- Comments content sanitizer
CREATE OR REPLACE FUNCTION public.trigger_sanitize_comment_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.content := public.sanitize_plain_text(NEW.content);
  RETURN NEW;
END;
$$;

-- Battle challenges message sanitizer
CREATE OR REPLACE FUNCTION public.trigger_sanitize_challenge_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.challenge_message := public.sanitize_plain_text(NEW.challenge_message);
  RETURN NEW;
END;
$$;

-- Spiders text fields sanitizer
CREATE OR REPLACE FUNCTION public.trigger_sanitize_spider_text_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nickname := public.sanitize_plain_text(NEW.nickname);
  NEW.species := public.sanitize_plain_text(NEW.species);
  RETURN NEW;
END;
$$;

-- Create triggers (drop if exist first to be idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sanitize_profile_display_name_biu'
  ) THEN
    DROP TRIGGER sanitize_profile_display_name_biu ON public.profiles;
  END IF;
  CREATE TRIGGER sanitize_profile_display_name_biu
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_profile_display_name();

  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sanitize_profile_bio_biu'
  ) THEN
    DROP TRIGGER sanitize_profile_bio_biu ON public.profiles;
  END IF;
  CREATE TRIGGER sanitize_profile_bio_biu
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_profile_bio();

  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sanitize_post_content_biu'
  ) THEN
    DROP TRIGGER sanitize_post_content_biu ON public.posts;
  END IF;
  CREATE TRIGGER sanitize_post_content_biu
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_post_content();

  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sanitize_comment_content_biu'
  ) THEN
    DROP TRIGGER sanitize_comment_content_biu ON public.comments;
  END IF;
  CREATE TRIGGER sanitize_comment_content_biu
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_comment_content();

  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sanitize_challenge_message_biu'
  ) THEN
    DROP TRIGGER sanitize_challenge_message_biu ON public.battle_challenges;
  END IF;
  CREATE TRIGGER sanitize_challenge_message_biu
  BEFORE INSERT OR UPDATE ON public.battle_challenges
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_challenge_message();

  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'sanitize_spider_text_fields_biu'
  ) THEN
    DROP TRIGGER sanitize_spider_text_fields_biu ON public.spiders;
  END IF;
  CREATE TRIGGER sanitize_spider_text_fields_biu
  BEFORE INSERT OR UPDATE ON public.spiders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_spider_text_fields();
END $$;

-- Phase 4: Basic rate limiting for challenge creation
CREATE OR REPLACE FUNCTION public.enforce_challenge_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.battle_challenges
  WHERE challenger_id = NEW.challenger_id
    AND created_at > now() - interval '10 minutes';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Please wait before creating more challenges.';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'enforce_challenge_rate_limit_bi'
  ) THEN
    DROP TRIGGER enforce_challenge_rate_limit_bi ON public.battle_challenges;
  END IF;
  CREATE TRIGGER enforce_challenge_rate_limit_bi
  BEFORE INSERT ON public.battle_challenges
  FOR EACH ROW EXECUTE FUNCTION public.enforce_challenge_rate_limit();
END $$;