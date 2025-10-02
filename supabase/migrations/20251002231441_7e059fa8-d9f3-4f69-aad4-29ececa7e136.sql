-- Retroactively update all spiders with improved attribute ratings based on species
DO $$
DECLARE
  spider_record RECORD;
  new_attrs RECORD;
BEGIN
  -- Loop through all spiders
  FOR spider_record IN 
    SELECT id, species, hit_points, damage, speed, defense, venom, webcraft
    FROM public.spiders
  LOOP
    -- Apply species bias using current attributes as base
    SELECT * INTO new_attrs
    FROM public.apply_species_bias(
      spider_record.species,
      spider_record.hit_points,
      spider_record.damage,
      spider_record.speed,
      spider_record.defense,
      spider_record.venom,
      spider_record.webcraft
    );
    
    -- Update the spider with new attributes
    UPDATE public.spiders
    SET 
      hit_points = new_attrs.hit_points,
      damage = new_attrs.damage,
      speed = new_attrs.speed,
      defense = new_attrs.defense,
      venom = new_attrs.venom,
      webcraft = new_attrs.webcraft,
      power_score = new_attrs.hit_points + new_attrs.damage + new_attrs.speed + 
                    new_attrs.defense + new_attrs.venom + new_attrs.webcraft,
      updated_at = now()
    WHERE id = spider_record.id;
  END LOOP;
END $$;