-- Create badge system tables
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL,
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  color text NOT NULL DEFAULT '#6b7280',
  criteria jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_badges junction table
CREATE TABLE public.user_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamp with time zone NOT NULL DEFAULT now(),
  progress jsonb DEFAULT '{}',
  UNIQUE(user_id, badge_id)
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- RLS policies for badges (read-only for authenticated users)
CREATE POLICY "Badges are viewable by authenticated users" 
ON public.badges 
FOR SELECT 
TO authenticated
USING (true);

-- RLS policies for user_badges
CREATE POLICY "Users can view all user badges" 
ON public.user_badges 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own badges" 
ON public.user_badges 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Insert initial badges
INSERT INTO public.badges (name, description, icon, rarity, color, criteria) VALUES
('First Spider', 'Upload your first spider to the collection', 'Trophy', 'common', '#10b981', '{"type": "spider_count", "target": 1}'),
('Spider Collector', 'Own 5 spiders in your collection', 'Crown', 'rare', '#3b82f6', '{"type": "spider_count", "target": 5}'),
('Spider Master', 'Own 10 spiders in your collection', 'Award', 'epic', '#8b5cf6', '{"type": "spider_count", "target": 10}'),
('First Victory', 'Win your first battle against another player', 'Sword', 'common', '#f59e0b', '{"type": "battles_won", "target": 1}'),
('Battle Veteran', 'Win 10 battles against other players', 'Shield', 'rare', '#ef4444', '{"type": "battles_won", "target": 10}'),
('Legendary Fighter', 'Win 50 battles against other players', 'Zap', 'legendary', '#f97316', '{"type": "battles_won", "target": 50}'),
('Power Player', 'Achieve 1000+ total power score', 'Star', 'rare', '#06b6d4', '{"type": "total_power", "target": 1000}'),
('Elite Trainer', 'Achieve 5000+ total power score', 'Flame', 'epic', '#d946ef', '{"type": "total_power", "target": 5000}'),
('Legendary Trainer', 'Achieve 10000+ total power score', 'Hexagon', 'legendary', '#fbbf24', '{"type": "total_power", "target": 10000}');

-- Function to award badges based on criteria
CREATE OR REPLACE FUNCTION public.award_badges_for_user(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  badge_record RECORD;
  user_spider_count INTEGER;
  user_battles_won INTEGER;
  user_total_power INTEGER;
BEGIN
  -- Get user stats
  SELECT COUNT(*) INTO user_spider_count 
  FROM public.spiders 
  WHERE owner_id = user_id_param AND is_approved = true;
  
  SELECT COUNT(*) INTO user_battles_won 
  FROM public.battle_challenges 
  WHERE winner_id = user_id_param AND status = 'COMPLETED';
  
  SELECT COALESCE(SUM(power_score), 0) INTO user_total_power 
  FROM public.spiders 
  WHERE owner_id = user_id_param AND is_approved = true;

  -- Check each badge criteria
  FOR badge_record IN SELECT * FROM public.badges LOOP
    -- Check if user already has this badge
    IF NOT EXISTS (
      SELECT 1 FROM public.user_badges 
      WHERE user_id = user_id_param AND badge_id = badge_record.id
    ) THEN
      -- Check criteria and award badge if met
      IF badge_record.criteria->>'type' = 'spider_count' AND 
         user_spider_count >= (badge_record.criteria->>'target')::integer THEN
        INSERT INTO public.user_badges (user_id, badge_id) VALUES (user_id_param, badge_record.id);
      ELSIF badge_record.criteria->>'type' = 'battles_won' AND 
            user_battles_won >= (badge_record.criteria->>'target')::integer THEN
        INSERT INTO public.user_badges (user_id, badge_id) VALUES (user_id_param, badge_record.id);
      ELSIF badge_record.criteria->>'type' = 'total_power' AND 
            user_total_power >= (badge_record.criteria->>'target')::integer THEN
        INSERT INTO public.user_badges (user_id, badge_id) VALUES (user_id_param, badge_record.id);
      END IF;
    END IF;
  END LOOP;
END;
$$;