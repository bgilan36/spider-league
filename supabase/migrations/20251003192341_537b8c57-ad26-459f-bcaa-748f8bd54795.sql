-- Function to remove a spider from weekly_uploads when ownership changes
CREATE OR REPLACE FUNCTION public.remove_spider_from_weekly_uploads()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If owner_id changed, remove this spider from old owner's weekly_uploads
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    -- Clear first_spider_id if it matches
    UPDATE public.weekly_uploads
    SET first_spider_id = NULL,
        upload_count = GREATEST(0, upload_count - 1),
        updated_at = now()
    WHERE first_spider_id = NEW.id
      AND user_id = OLD.owner_id;
    
    -- Clear second_spider_id if it matches
    UPDATE public.weekly_uploads
    SET second_spider_id = NULL,
        upload_count = GREATEST(0, upload_count - 1),
        updated_at = now()
    WHERE second_spider_id = NEW.id
      AND user_id = OLD.owner_id;
    
    -- Clear third_spider_id if it matches
    UPDATE public.weekly_uploads
    SET third_spider_id = NULL,
        upload_count = GREATEST(0, upload_count - 1),
        updated_at = now()
    WHERE third_spider_id = NEW.id
      AND user_id = OLD.owner_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically remove spider from weekly_uploads on ownership transfer
DROP TRIGGER IF EXISTS spider_ownership_changed ON public.spiders;
CREATE TRIGGER spider_ownership_changed
  AFTER UPDATE OF owner_id ON public.spiders
  FOR EACH ROW
  WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
  EXECUTE FUNCTION public.remove_spider_from_weekly_uploads();