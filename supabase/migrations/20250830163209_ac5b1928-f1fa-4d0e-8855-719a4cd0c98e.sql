-- Phase 1: Restrict profiles SELECT to own profile only
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users only" ON public.profiles;

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

-- Create triggers
DROP TRIGGER IF EXISTS sanitize_profile_bio_biu ON public.profiles;
CREATE TRIGGER sanitize_profile_bio_biu
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_profile_bio();

DROP TRIGGER IF EXISTS sanitize_post_content_biu ON public.posts;
CREATE TRIGGER sanitize_post_content_biu
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_post_content();

DROP TRIGGER IF EXISTS sanitize_comment_content_biu ON public.comments;
CREATE TRIGGER sanitize_comment_content_biu
BEFORE INSERT OR UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_comment_content();

DROP TRIGGER IF EXISTS sanitize_challenge_message_biu ON public.battle_challenges;
CREATE TRIGGER sanitize_challenge_message_biu
BEFORE INSERT OR UPDATE ON public.battle_challenges
FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_challenge_message();

DROP TRIGGER IF EXISTS sanitize_spider_text_fields_biu ON public.spiders;
CREATE TRIGGER sanitize_spider_text_fields_biu
BEFORE INSERT OR UPDATE ON public.spiders
FOR EACH ROW EXECUTE FUNCTION public.trigger_sanitize_spider_text_fields();

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

DROP TRIGGER IF EXISTS enforce_challenge_rate_limit_bi ON public.battle_challenges;
CREATE TRIGGER enforce_challenge_rate_limit_bi
BEFORE INSERT ON public.battle_challenges
FOR EACH ROW EXECUTE FUNCTION public.enforce_challenge_rate_limit();