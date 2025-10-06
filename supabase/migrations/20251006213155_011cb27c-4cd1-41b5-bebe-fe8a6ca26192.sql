-- Make handle_new_user trigger more robust with better error handling
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
  new_spider_id UUID;
BEGIN
  -- Check if profile already exists (defensive programming)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    -- Profile already exists, just return NEW to not block the user creation
    RETURN NEW;
  END IF;
  
  -- Insert profile with error handling
  BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
      NEW.raw_user_meta_data ->> 'avatar_url'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
  END;
  
  -- Get the display name for the starter spider
  SELECT display_name INTO user_display_name FROM public.profiles WHERE id = NEW.id;
  
  -- Use the starter spider image
  starter_image_url := 'https://wdqsgswrkrxjeesahshc.supabase.co/storage/v1/object/public/spiders/starter-spider.png';
  
  -- Generate random attributes that sum to 300 power score
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
  
  -- Create the starter spider with error handling
  BEGIN
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
    ) RETURNING id INTO new_spider_id;
    
    -- Register the starter spider in weekly_uploads
    PERFORM public.increment_weekly_upload(NEW.id, new_spider_id);
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create starter spider for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();