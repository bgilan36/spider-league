-- Create enums for Spider League
CREATE TYPE public.spider_rarity AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
CREATE TYPE public.battle_type AS ENUM ('SANDBOX', 'MATCHUP');
CREATE TYPE public.battle_winner AS ENUM ('A', 'B', 'TIE');
CREATE TYPE public.matchup_result AS ENUM ('A_WIN', 'B_WIN', 'TIE', 'NO_CONTEST');

-- Update profiles table for Spider League
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating_elo INTEGER DEFAULT 1000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS season_wins INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS season_losses INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS season_ties INTEGER DEFAULT 0;

-- Create spiders table
CREATE TABLE public.spiders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'Unknown',
  nickname TEXT NOT NULL,
  rarity spider_rarity NOT NULL DEFAULT 'COMMON',
  hit_points INTEGER NOT NULL CHECK (hit_points >= 0 AND hit_points <= 100),
  damage INTEGER NOT NULL CHECK (damage >= 0 AND damage <= 100),
  speed INTEGER NOT NULL CHECK (speed >= 0 AND speed <= 100),
  defense INTEGER NOT NULL CHECK (defense >= 0 AND defense <= 100),
  venom INTEGER NOT NULL CHECK (venom >= 0 AND venom <= 100),
  webcraft INTEGER NOT NULL CHECK (webcraft >= 0 AND webcraft <= 100),
  special_attacks JSONB DEFAULT '[]'::jsonb,
  power_score INTEGER NOT NULL DEFAULT 0,
  rng_seed TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create battles table
CREATE TABLE public.battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  type battle_type NOT NULL DEFAULT 'SANDBOX',
  team_a JSONB NOT NULL, -- array of spider IDs
  team_b JSONB NOT NULL, -- array of spider IDs
  winner battle_winner,
  battle_log JSONB DEFAULT '{}'::jsonb,
  rng_seed TEXT NOT NULL
);

-- Create seasons table
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  current_week_number INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create weeks table
CREATE TABLE public.weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(season_id, week_number)
);

-- Create matchups table
CREATE TABLE public.matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_a JSONB DEFAULT '[]'::jsonb, -- spider IDs
  team_b JSONB DEFAULT '[]'::jsonb, -- spider IDs
  result matchup_result,
  battle_id UUID REFERENCES public.battles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.spiders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for spiders
CREATE POLICY "Approved spiders are viewable by everyone" ON public.spiders
  FOR SELECT USING (is_approved = true);

CREATE POLICY "Users can view their own spiders" ON public.spiders
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own spiders" ON public.spiders
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own spiders" ON public.spiders
  FOR UPDATE USING (auth.uid() = owner_id);

-- RLS Policies for battles
CREATE POLICY "Battles are viewable by everyone" ON public.battles
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create battles" ON public.battles
  FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for seasons (read-only for users)
CREATE POLICY "Seasons are viewable by everyone" ON public.seasons
  FOR SELECT USING (true);

-- RLS Policies for weeks (read-only for users)
CREATE POLICY "Weeks are viewable by everyone" ON public.weeks
  FOR SELECT USING (true);

-- RLS Policies for matchups
CREATE POLICY "Matchups are viewable by everyone" ON public.matchups
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create matchups" ON public.matchups
  FOR INSERT TO authenticated WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_spiders_updated_at
  BEFORE UPDATE ON public.spiders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seasons_updated_at
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matchups_updated_at
  BEFORE UPDATE ON public.matchups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_spiders_owner_id ON public.spiders(owner_id);
CREATE INDEX idx_spiders_approved ON public.spiders(is_approved);
CREATE INDEX idx_spiders_power_score ON public.spiders(power_score DESC);
CREATE INDEX idx_battles_type ON public.battles(type);
CREATE INDEX idx_weeks_season_id ON public.weeks(season_id);
CREATE INDEX idx_matchups_season_week ON public.matchups(season_id, week_id);
CREATE INDEX idx_matchups_users ON public.matchups(user_a_id, user_b_id);