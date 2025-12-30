-- Update the handle_new_user function to create starter spiders with 250 power score instead of 300
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = ''
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  user_display_name TEXT;
  starter_image_url TEXT;
  attr_hp INTEGER;
  attr_dmg INTEGER;
  attr_spd INTEGER;
  attr_def INTEGER;
  attr_vnm INTEGER;
  attr_web INTEGER;
  total_stats INTEGER;
  new_spider_id UUID;
BEGIN
  -- Insert profile (this is the existing behavior we keep)
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  
  -- Get the display name for the starter spider
  SELECT display_name INTO user_display_name FROM public.profiles WHERE id = NEW.id;
  
  -- Use the starter spider image
  starter_image_url := 'https://wdqsgswrkrxjeesahshc.supabase.co/storage/v1/object/public/spiders/starter-spider.png';
  
  -- Generate random attributes that sum to 250 power score (reduced from 300)
  -- Each stat ranges from roughly 30-50 to create variety
  attr_hp := 30 + floor(random() * 20);
  attr_dmg := 30 + floor(random() * 20);
  attr_spd := 30 + floor(random() * 20);
  attr_def := 30 + floor(random() * 20);
  attr_vnm := 30 + floor(random() * 20);
  attr_web := 30 + floor(random() * 20);
  
  -- Calculate total and adjust to hit exactly 250
  total_stats := attr_hp + attr_dmg + attr_spd + attr_def + attr_vnm + attr_web;
  
  -- Distribute the difference to hit 250
  IF total_stats < 250 THEN
    attr_hp := attr_hp + (250 - total_stats);
  ELSIF total_stats > 250 THEN
    attr_hp := attr_hp - (total_stats - 250);
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
      attr_vnm,
      attr_web,
      250,
      true,
      encode(gen_random_bytes(8), 'hex')
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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();