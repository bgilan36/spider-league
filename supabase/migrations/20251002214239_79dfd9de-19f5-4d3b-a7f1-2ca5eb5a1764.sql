-- ============================================
-- Security Fixes Migration
-- ============================================

-- 1. Create admin role system
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Fix battles table
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can create battles" ON public.battles;
DROP POLICY IF EXISTS "Battles are viewable by everyone" ON public.battles;

CREATE POLICY "Authenticated users can create battles"
ON public.battles
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Battles are viewable by participants"
ON public.battles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only system can update battles"
ON public.battles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No one can delete battles"
ON public.battles
FOR DELETE
TO authenticated
USING (false);

-- 3. Fix battle_turns
-- ============================================

DROP POLICY IF EXISTS "Battle participants can insert turns" ON public.battle_turns;
DROP POLICY IF EXISTS "Battle participants can view turns" ON public.battle_turns;

CREATE POLICY "Battle participants can insert turns"
ON public.battle_turns
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.battles
    WHERE battles.id = battle_turns.battle_id
      AND battles.current_turn_user_id = auth.uid()
      AND battles.is_active = true
  )
);

CREATE POLICY "Battle participants can view turns"
ON public.battle_turns
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.battles
    WHERE battles.id = battle_turns.battle_id
      AND (
        (battles.team_a->>'userId')::uuid = auth.uid()
        OR (battles.team_b->>'userId')::uuid = auth.uid()
      )
  )
);

CREATE POLICY "No one can update battle turns"
ON public.battle_turns
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No one can delete battle turns"
ON public.battle_turns
FOR DELETE
TO authenticated
USING (false);

-- 4. Fix profiles table
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view public profile information"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 5. Update storage policies - drop existing ones first
-- ============================================

DROP POLICY IF EXISTS "Anyone can view spider images" ON storage.objects;
DROP POLICY IF EXISTS "Public spider images" ON storage.objects;
DROP POLICY IF EXISTS "Spider images viewable by authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own spider images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own spider images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own spider images" ON storage.objects;

CREATE POLICY "Spider images viewable by authenticated users"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'spiders');

CREATE POLICY "Users can upload their own spider images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'spiders' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own spider images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'spiders' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own spider images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'spiders' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Add audit logging
-- ============================================

CREATE TABLE public.battle_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  modified_by UUID,
  modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.battle_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.battle_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_battle_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.battle_audit_log (battle_id, action, old_values, new_values, modified_by)
  VALUES (NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER battle_audit_trigger
AFTER UPDATE ON public.battles
FOR EACH ROW
EXECUTE FUNCTION public.log_battle_changes();