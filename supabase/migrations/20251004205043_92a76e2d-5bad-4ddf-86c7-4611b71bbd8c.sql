-- Drop and recreate the handle_new_user function to include starter spider creation
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_display_name TEXT;
  starter_image_url TEXT;
  attr_hp INTEGER;
  attr_dmg INTEGER;
  attr_spd INTEGER;
  attr_def INTEGER;
  attr_ven INTEGER;
  attr_web INTEGER;
  remaining INTEGER;
BEGIN
  -- Insert profile first
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  
  -- Get the display name for the starter spider
  SELECT display_name INTO user_display_name FROM public.profiles WHERE id = NEW.id;
  
  -- Use the starter spider image (must be uploaded to Supabase storage bucket 'spiders')
  starter_image_url := 'https://wdqsgswrkrxjeesahshc.supabase.co/storage/v1/object/public/spiders/starter-spider.png';
  
  -- Generate random attributes that sum to 300 power score
  -- Each attribute between 30-70 for balanced distribution
  attr_hp := 30 + floor(random() * 41)::INTEGER;
  attr_dmg := 30 + floor(random() * 41)::INTEGER;
  attr_spd := 30 + floor(random() * 41)::INTEGER;
  attr_def := 30 + floor(random() * 41)::INTEGER;
  attr_ven := 30 + floor(random() * 41)::INTEGER;
  
  -- Calculate remaining points for last attribute
  remaining := 300 - (attr_hp + attr_dmg + attr_spd + attr_def + attr_ven);
  attr_web := GREATEST(10, LEAST(100, remaining));
  
  -- Adjust if webcraft was clamped outside valid range
  IF remaining <> attr_web THEN
    remaining := 300 - (attr_hp + attr_dmg + attr_spd + attr_def + attr_ven + attr_web);
    attr_hp := attr_hp + remaining;
  END IF;
  
  -- Create the starter spider (approved and ready for battles)
  INSERT INTO public.spiders (
    owner_id,
    nickname,
    species,
    image_url,
    rarity,
    hit_points,
    damage,
    speed,
    defense,
    venom,
    webcraft,
    power_score,
    is_approved,
    rng_seed
  ) VALUES (
    NEW.id,
    user_display_name || '''s Starter Spider',
    'Spider League Starter Spider',
    starter_image_url,
    'COMMON',
    attr_hp,
    attr_dmg,
    attr_spd,
    attr_def,
    attr_ven,
    attr_web,
    300,
    true,
    gen_random_uuid()::TEXT
  );
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();