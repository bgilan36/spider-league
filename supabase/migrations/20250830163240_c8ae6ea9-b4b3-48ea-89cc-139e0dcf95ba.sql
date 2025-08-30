-- Fix search path security warnings for all functions
CREATE OR REPLACE FUNCTION public.sanitize_plain_text(t text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.trigger_sanitize_profile_bio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.bio := public.sanitize_plain_text(NEW.bio);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sanitize_post_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.content := public.sanitize_plain_text(NEW.content);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sanitize_comment_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.content := public.sanitize_plain_text(NEW.content);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sanitize_challenge_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.challenge_message := public.sanitize_plain_text(NEW.challenge_message);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sanitize_spider_text_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.nickname := public.sanitize_plain_text(NEW.nickname);
  NEW.species := public.sanitize_plain_text(NEW.species);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_challenge_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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