-- Create roadmap system with upvoting functionality

-- Create roadmap_items table
CREATE TABLE public.roadmap_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  category text NOT NULL,
  status text NOT NULL CHECK (status IN ('BACKLOG', 'IN_PROGRESS', 'COMPLETED')),
  upvote_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create roadmap_upvotes table for tracking user upvotes
CREATE TABLE public.roadmap_upvotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  roadmap_item_id uuid NOT NULL REFERENCES public.roadmap_items(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, roadmap_item_id)
);

-- Enable RLS on roadmap_items
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

-- Enable RLS on roadmap_upvotes  
ALTER TABLE public.roadmap_upvotes ENABLE ROW LEVEL SECURITY;

-- RLS policies for roadmap_items
CREATE POLICY "Roadmap items are viewable by everyone" 
ON public.roadmap_items 
FOR SELECT 
USING (true);

-- RLS policies for roadmap_upvotes
CREATE POLICY "Upvotes are viewable by everyone" 
ON public.roadmap_upvotes 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own upvotes" 
ON public.roadmap_upvotes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own upvotes" 
ON public.roadmap_upvotes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at column
CREATE TRIGGER update_roadmap_items_updated_at
BEFORE UPDATE ON public.roadmap_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update upvote count when upvotes are added/removed
CREATE OR REPLACE FUNCTION public.update_roadmap_upvote_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.roadmap_items 
    SET upvote_count = upvote_count + 1 
    WHERE id = NEW.roadmap_item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.roadmap_items 
    SET upvote_count = upvote_count - 1 
    WHERE id = OLD.roadmap_item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Create triggers for upvote count updates
CREATE TRIGGER update_upvote_count_on_insert
AFTER INSERT ON public.roadmap_upvotes
FOR EACH ROW
EXECUTE FUNCTION public.update_roadmap_upvote_count();

CREATE TRIGGER update_upvote_count_on_delete
AFTER DELETE ON public.roadmap_upvotes
FOR EACH ROW
EXECUTE FUNCTION public.update_roadmap_upvote_count();

-- Insert initial roadmap data (without time estimates and testing items)
INSERT INTO public.roadmap_items (title, description, priority, category, status, upvote_count) VALUES
('Spider Battle Arena', 'Real-time multiplayer spider battles with spectator mode', 'HIGH', 'Combat', 'BACKLOG', 0),
('Mobile App', 'Native mobile app for iOS and Android', 'MEDIUM', 'Platform', 'BACKLOG', 0),
('Spider Trading Market', 'Marketplace for trading spiders between players', 'MEDIUM', 'Economy', 'BACKLOG', 0),
('Weekly Leaderboards', 'Time-based ranking system that resets weekly', 'HIGH', 'Competition', 'IN_PROGRESS', 0),
('Enhanced Spider AI', 'Improved spider classification and rarity detection', 'HIGH', 'AI/ML', 'IN_PROGRESS', 0),
('Spider Upload System', 'AI-powered spider identification and classification', 'HIGH', 'Core', 'COMPLETED', 0),
('Power Score System', 'Dynamic spider power calculation algorithm', 'HIGH', 'Core', 'COMPLETED', 0);