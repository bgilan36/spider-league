import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Plus, Upload, Sparkles, RefreshCcw, Target, Trophy, Check, Star, BarChart3, Swords, TrendingUp, TrendingDown, Minus, Zap, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SpiderDetailsModal from '@/components/SpiderDetailsModal';
import BattleButton from '@/components/BattleButton';

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  created_at?: string;
  source?: 'activated' | 'uploaded';
  hit_points?: number;
  damage?: number;
  speed?: number;
  defense?: number;
  venom?: number;
  webcraft?: number;
  is_approved?: boolean;
  owner_id?: string;
}

interface WeeklyEligibleSpidersProps {
  onSpiderChange?: () => void;
}

const rarityColors: Record<string, string> = {
  COMMON: 'bg-gray-500',
  UNCOMMON: 'bg-green-500',
  RARE: 'bg-blue-500',
  EPIC: 'bg-purple-500',
  LEGENDARY: 'bg-amber-500',
};

const WeeklyEligibleSpiders: React.FC<WeeklyEligibleSpidersProps> = ({ onSpiderChange }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activatedSpider, setActivatedSpider] = useState<Spider | null>(null);
  const [uploadedSpiders, setUploadedSpiders] = useState<Spider[]>([]);
  const [allSpiders, setAllSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevFilledSlots = useRef(0);
  const [selectedSpiderForStats, setSelectedSpiderForStats] = useState<Spider | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [topOpponents, setTopOpponents] = useState<Spider[]>([]);
  const [quickBattleLoading, setQuickBattleLoading] = useState(false);
  const [suggestedMatch, setSuggestedMatch] = useState<{ yourSpider: Spider; opponent: Spider } | null>(null);

  useEffect(() => {
    if (user) {
      fetchEligibleSpiders();
      fetchAllSpiders();
      fetchTopOpponents();
    }
  }, [user]);

  const getWeekStartStr = () => {
    const ptNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const dayOfWeek = ptNow.getDay();
    const weekStart = new Date(ptNow);
    weekStart.setDate(ptNow.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart.toISOString().split('T')[0];
  };

  const fetchEligibleSpiders = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const weekStartStr = getWeekStartStr();
      const weekStartISO = new Date(weekStartStr + 'T00:00:00-08:00').toISOString();
      
      // Fetch activated spider from weekly_roster
      const { data: rosterData, error: rosterError } = await (supabase as any)
        .from('weekly_roster')
        .select(`
          spider_id,
          spiders (
            id,
            nickname,
            species,
            image_url,
            power_score,
            rarity,
            created_at,
            hit_points,
            damage,
            speed,
            defense,
            venom,
            webcraft,
            is_approved,
            owner_id
          )
        `)
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .maybeSingle();

      if (rosterError && rosterError.code !== 'PGRST116') {
        console.error('Error fetching roster:', rosterError);
      }
      
      if (rosterData?.spiders) {
        setActivatedSpider({
          ...rosterData.spiders,
          source: 'activated'
        });
      } else {
        setActivatedSpider(null);
      }
      
      // Fetch spiders uploaded this week
      const { data: uploadedData, error: uploadedError } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, power_score, rarity, created_at, hit_points, damage, speed, defense, venom, webcraft, is_approved, owner_id')
        .eq('owner_id', user.id)
        .eq('is_approved', true)
        .gte('created_at', weekStartISO)
        .order('created_at', { ascending: true })
        .limit(3);

      if (uploadedError) {
        console.error('Error fetching uploaded spiders:', uploadedError);
      }
      
      // Filter out activated spider from uploaded list if it was uploaded this week
      const activatedId = rosterData?.spider_id;
      const uploaded = (uploadedData || []).filter((s: Spider) => s.id !== activatedId);
      setUploadedSpiders(uploaded.slice(0, 3).map((s: Spider) => ({ ...s, source: 'uploaded' as const })));
      
    } catch (error) {
      console.error('Error fetching eligible spiders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSpiders = async () => {
    if (!user) return;

    try {
      const weekStartStr = getWeekStartStr();
      const weekStartISO = new Date(weekStartStr + 'T00:00:00-08:00').toISOString();
      
      // Fetch spiders from BEFORE this week (for activation)
      const { data, error } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, power_score, rarity, created_at, hit_points, damage, speed, defense, venom, webcraft, is_approved, owner_id')
        .eq('owner_id', user.id)
        .eq('is_approved', true)
        .lt('created_at', weekStartISO)
        .order('power_score', { ascending: false });

      if (error) throw error;
      setAllSpiders((data || []) as Spider[]);
    } catch (error) {
      console.error('Error fetching spiders:', error);
    }
  };

  const fetchTopOpponents = async () => {
    if (!user) return;
    
    try {
      // Fetch top 5 spiders from other users for comparison
      const { data, error } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, power_score, rarity, owner_id')
        .eq('is_approved', true)
        .neq('owner_id', user.id)
        .order('power_score', { ascending: false })
        .limit(5);

      if (error) throw error;
      setTopOpponents((data || []) as Spider[]);
    } catch (error) {
      console.error('Error fetching top opponents:', error);
    }
  };

  // Find closest-powered opponent for quick battle
  const findClosestOpponent = (yourSpiders: Spider[], opponents: Spider[]): { yourSpider: Spider; opponent: Spider } | null => {
    if (yourSpiders.length === 0 || opponents.length === 0) return null;
    
    // Use your best spider for the match
    const yourBestSpider = yourSpiders.reduce((best, s) => s.power_score > best.power_score ? s : best);
    
    // Find opponent with closest power score
    let closestOpponent = opponents[0];
    let smallestDiff = Math.abs(yourBestSpider.power_score - opponents[0].power_score);
    
    for (const opponent of opponents) {
      const diff = Math.abs(yourBestSpider.power_score - opponent.power_score);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestOpponent = opponent;
      }
    }
    
    return { yourSpider: yourBestSpider, opponent: closestOpponent };
  };

  // Handle quick battle - automatically create challenge with closest opponent
  const handleQuickBattle = async () => {
    if (!user) return;
    
    const filledSpiders = eligibleSpiders.filter((s): s is Spider => s !== null);
    if (filledSpiders.length === 0 || topOpponents.length === 0) {
      toast.error('You need eligible spiders to start a quick battle');
      return;
    }
    
    const match = findClosestOpponent(filledSpiders, topOpponents);
    if (!match) {
      toast.error('Could not find a suitable opponent');
      return;
    }
    
    setSuggestedMatch(match);
    setQuickBattleLoading(true);
    
    try {
      // Create the challenge
      const { data, error } = await supabase
        .from('battle_challenges')
        .insert({
          challenger_id: user.id,
          challenger_spider_id: match.yourSpider.id,
          accepter_id: match.opponent.owner_id,
          accepter_spider_id: match.opponent.id,
          challenge_message: `⚡ Quick Battle! ${match.yourSpider.nickname} challenges ${match.opponent.nickname}!`
        })
        .select('id, created_at, expires_at, status')
        .single();

      if (error) throw error;
      
      toast.success(`Challenge sent! ${match.yourSpider.nickname} vs ${match.opponent.nickname}`);
      
      // Notify other components
      window.dispatchEvent(new CustomEvent('challenge:created', { 
        detail: { id: data.id, challenger_id: user.id, challenger_spider_id: match.yourSpider.id } 
      }));
      
      onSpiderChange?.();
    } catch (error: any) {
      console.error('Error creating quick battle:', error);
      toast.error(error.message || 'Failed to create challenge');
    } finally {
      setQuickBattleLoading(false);
      setTimeout(() => setSuggestedMatch(null), 3000);
    }
  };

  const handleActivateSpider = async (spiderId: string) => {
    if (!user) return;
    
    try {
      const weekStartStr = getWeekStartStr();
      
      // Clear any existing roster entry for this week
      await (supabase as any)
        .from('weekly_roster')
        .delete()
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr);
      
      // Insert the new roster entry
      const { error } = await (supabase as any)
        .from('weekly_roster')
        .insert({
          user_id: user.id,
          week_start: weekStartStr,
          spider_id: spiderId,
          slot_number: 1,
        });

      if (error) throw error;
      
      toast.success('Spider activated for this week!');
      await fetchEligibleSpiders();
      setIsDialogOpen(false);
      onSpiderChange?.();
    } catch (error: any) {
      console.error('Error activating spider:', error);
      toast.error(error.message || 'Failed to activate spider');
    }
  };

  const handleDeactivateSpider = async () => {
    if (!user) return;
    
    try {
      const weekStartStr = getWeekStartStr();
      
      const { error } = await (supabase as any)
        .from('weekly_roster')
        .delete()
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr);

      if (error) throw error;
      
      toast.success('Spider deactivated');
      await fetchEligibleSpiders();
      onSpiderChange?.();
    } catch (error: any) {
      console.error('Error deactivating spider:', error);
      toast.error(error.message || 'Failed to deactivate spider');
    }
  };

  if (!user) return null;

  // Calculate eligible spider slots
  const eligibleSpiders: (Spider | null)[] = [];
  
  // Slot 1: Activated spider (from past collection)
  if (activatedSpider) {
    eligibleSpiders.push(activatedSpider);
  }
  
  // Add uploaded spiders (up to remaining slots)
  const maxUploads = activatedSpider ? 2 : 3;
  uploadedSpiders.slice(0, maxUploads).forEach(spider => {
    eligibleSpiders.push(spider);
  });
  
  // Fill remaining slots with null
  while (eligibleSpiders.length < 3) {
    eligibleSpiders.push(null);
  }

  const filledSlots = eligibleSpiders.filter(s => s !== null).length;
  const progressPercent = (filledSlots / 3) * 100;

  // Trigger celebration when roster becomes complete
  useEffect(() => {
    if (filledSlots === 3 && prevFilledSlots.current < 3 && prevFilledSlots.current > 0) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
    prevFilledSlots.current = filledSlots;
  }, [filledSlots]);

  // Generate confetti particles
  const confettiParticles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 5)],
  }));

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 relative overflow-hidden">
      {/* Celebration Animation */}
      <AnimatePresence>
        {showCelebration && (
          <>
            {/* Confetti particles */}
            {confettiParticles.map((particle) => (
              <motion.div
                key={particle.id}
                initial={{ y: -20, x: `${particle.x}%`, opacity: 1, scale: 0 }}
                animate={{ 
                  y: '100%', 
                  opacity: [1, 1, 0],
                  scale: [0, 1, 1],
                  rotate: [0, 360, 720]
                }}
                exit={{ opacity: 0 }}
                transition={{ 
                  duration: 2.5, 
                  delay: particle.delay,
                  ease: 'easeOut'
                }}
                className="absolute z-10 pointer-events-none"
                style={{ left: `${particle.x}%` }}
              >
                <Star className="h-4 w-4" style={{ color: particle.color, fill: particle.color }} />
              </motion.div>
            ))}
            
            {/* Glowing overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.3, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-primary/10 to-amber-500/20 pointer-events-none z-0"
            />
          </>
        )}
      </AnimatePresence>

      <CardContent className="p-4 sm:p-6 relative z-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="p-2 rounded-lg bg-primary/10"
              animate={showCelebration ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
              transition={{ duration: 0.5, repeat: showCelebration ? 3 : 0 }}
            >
              <Target className="h-5 w-5 text-primary" />
            </motion.div>
            <div>
              <h3 className="font-bold text-lg">This Week's Eligible Spiders</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Build your battle roster: {filledSlots}/3 slots filled
              </p>
            </div>
          </div>
          
          {filledSlots === 3 && (
            <motion.div
              initial={showCelebration ? { scale: 0, rotate: -180 } : { scale: 1 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10 }}
            >
              <Badge className="bg-green-600 text-white gap-1 self-start sm:self-auto">
                <Check className="h-3 w-3" />
                Roster Complete!
              </Badge>
            </motion.div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* 3-Slot Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {eligibleSpiders.map((spider, index) => {
            const isActivatedSlot = index === 0 && activatedSpider;
            const isUploadSlot = !isActivatedSlot;
            const isEmpty = spider === null;
            
            if (isEmpty) {
              // Empty slot - show options based on whether user has already activated a past spider
              const hasActivatedSpider = activatedSpider !== null;
              const canShowActivateOption = !hasActivatedSpider && allSpiders.length > 0;
              const uploadsRemaining = maxUploads - uploadedSpiders.length;
              
              return (
                <Card 
                  key={index}
                  className="border-2 border-dashed border-muted-foreground/30 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <CardContent className="p-4 flex flex-col items-center justify-center min-h-[180px] text-center">
                    {canShowActivateOption ? (
                      // Show BOTH options: Upload OR Activate
                      <div className="flex flex-col items-center w-full space-y-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Plus className="h-5 w-5 text-primary" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Fill This Slot</p>
                        
                        <div className="flex flex-col gap-2 w-full">
                          {/* Upload Option */}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 w-full"
                            onClick={() => navigate('/upload')}
                          >
                            <Upload className="h-4 w-4" />
                            Upload New Spider
                          </Button>
                          
                          {/* Activate Option */}
                          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-2 w-full text-muted-foreground hover:text-foreground">
                                <RefreshCcw className="h-4 w-4" />
                                Activate Past Spider
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <Sparkles className="h-5 w-5 text-primary" />
                                  Activate Past Spider
                                </DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground mb-4">
                                Choose 1 spider from your collection (uploaded before this week) to be eligible for battles.
                              </p>
                              <ScrollArea className="max-h-[60vh]">
                                <div className="space-y-2 pr-4">
                                  {allSpiders.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">
                                      No past spiders available. Upload some spiders first!
                                    </p>
                                  ) : (
                                    allSpiders.map((s) => (
                                      <Card
                                        key={s.id}
                                        className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                        onClick={() => handleActivateSpider(s.id)}
                                      >
                                        <CardContent className="p-3">
                                          <div className="flex items-center gap-3">
                                            <img
                                              src={s.image_url}
                                              alt={s.nickname}
                                              className="w-12 h-12 rounded object-cover"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium truncate">{s.nickname}</p>
                                              <p className="text-xs text-muted-foreground truncate">{s.species}</p>
                                            </div>
                                            <div className="text-right">
                                              <Badge className={`${rarityColors[s.rarity]} text-white text-[10px]`}>
                                                {s.rarity}
                                              </Badge>
                                              <p className="text-xs text-muted-foreground mt-1">⚡ {s.power_score}</p>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))
                                  )}
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </div>
                        
                        <p className="text-[10px] text-muted-foreground/60">
                          {uploadsRemaining} upload{uploadsRemaining !== 1 ? 's' : ''} remaining
                        </p>
                      </div>
                    ) : (
                      // Only show Upload option (past spider already activated OR no past spiders available)
                      <>
                        <div className="p-3 rounded-full bg-primary/10 mb-3">
                          <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Upload New Spider</p>
                        <p className="text-xs text-muted-foreground/70 mb-3">
                          {uploadsRemaining > 0 
                            ? `${uploadsRemaining} upload${uploadsRemaining > 1 ? 's' : ''} remaining`
                            : 'Limit reached'}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => navigate('/upload')}
                          disabled={uploadsRemaining <= 0}
                        >
                          <Plus className="h-4 w-4" />
                          Upload
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            }

            // Filled slot
            return (
              <Card 
                key={spider.id}
                className={`overflow-hidden border-2 ${
                  spider.source === 'activated' 
                    ? 'border-amber-500/50 bg-amber-500/5' 
                    : 'border-green-500/50 bg-green-500/5'
                }`}
              >
                <div 
                  className="aspect-square relative cursor-pointer group"
                  onClick={() => {
                    setSelectedSpiderForStats(spider);
                    setIsStatsModalOpen(true);
                  }}
                >
                  <img
                    src={spider.image_url}
                    alt={spider.nickname}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  {/* Hover overlay with stats hint */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-1 text-white text-sm font-medium">
                      <BarChart3 className="h-4 w-4" />
                      View Stats
                    </div>
                  </div>
                  <Badge 
                    className={`absolute top-2 right-2 ${rarityColors[spider.rarity]} text-white text-[10px]`}
                  >
                    {spider.rarity}
                  </Badge>
                  <Badge 
                    className={`absolute top-2 left-2 text-[10px] ${
                      spider.source === 'activated' 
                        ? 'bg-amber-600 text-white' 
                        : 'bg-green-600 text-white'
                    }`}
                  >
                    {spider.source === 'activated' ? 'Activated' : 'Uploaded'}
                  </Badge>
                </div>
                <div className="p-3 text-center">
                  <p className="font-bold text-sm truncate">{spider.nickname}</p>
                  <p className="text-xs text-muted-foreground truncate mb-1">{spider.species}</p>
                  <p className="text-xs mb-2">⚡ {spider.power_score}</p>
                  
                  {/* Action buttons */}
                  <div className="flex gap-1 justify-center">
                    <BattleButton 
                      targetSpider={{
                        ...spider,
                        hit_points: spider.hit_points || 0,
                        damage: spider.damage || 0,
                        speed: spider.speed || 0,
                        defense: spider.defense || 0,
                        venom: spider.venom || 0,
                        webcraft: spider.webcraft || 0,
                        is_approved: spider.is_approved ?? true,
                      }}
                      size="sm"
                      variant="default"
                      className="flex-1 h-7 text-xs gap-1"
                    />
                    {spider.source === 'activated' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeactivateSpider();
                        }}
                      >
                        Change
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Power Comparison Section */}
        {filledSlots > 0 && topOpponents.length > 0 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-primary/5 via-background to-primary/5 rounded-lg border border-primary/10">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Power Comparison vs Top Opponents</h4>
            </div>
            
            {(() => {
              const filledSpiders = eligibleSpiders.filter((s): s is Spider => s !== null);
              const yourTotalPower = filledSpiders.reduce((sum, s) => sum + s.power_score, 0);
              const yourAvgPower = Math.round(yourTotalPower / filledSpiders.length);
              const topOpponentAvg = Math.round(topOpponents.reduce((sum, s) => sum + s.power_score, 0) / topOpponents.length);
              const topOpponentMax = Math.max(...topOpponents.map(s => s.power_score));
              const yourMaxPower = Math.max(...filledSpiders.map(s => s.power_score));
              const powerDiff = yourAvgPower - topOpponentAvg;
              
              return (
                <div className="space-y-3">
                  {/* Your Stats vs Top Opponents */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-background/50 rounded-lg p-3 border">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Your Roster</p>
                      <p className="text-xl font-bold text-primary">⚡ {yourTotalPower}</p>
                      <p className="text-[10px] text-muted-foreground">Avg: {yourAvgPower} | Best: {yourMaxPower}</p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-3 border">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Top 5 Opponents</p>
                      <p className="text-xl font-bold text-amber-500">⚡ {topOpponentAvg}</p>
                      <p className="text-[10px] text-muted-foreground">Avg Score | Best: {topOpponentMax}</p>
                    </div>
                  </div>
                  
                  {/* Power Difference Indicator */}
                  <div className={`flex items-center justify-center gap-2 p-2 rounded-lg ${
                    powerDiff > 50 ? 'bg-green-500/10 text-green-600' :
                    powerDiff > 0 ? 'bg-green-500/5 text-green-500' :
                    powerDiff > -50 ? 'bg-amber-500/10 text-amber-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {powerDiff > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : powerDiff < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <Minus className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      {powerDiff > 50 ? 'Dominant Position! Your roster outpowers the competition.' :
                       powerDiff > 0 ? `You're ahead by ${powerDiff} avg power.` :
                       powerDiff > -50 ? `Close matchup! ${Math.abs(powerDiff)} power behind avg.` :
                       `Underdog status: ${Math.abs(powerDiff)} power behind. Upload stronger spiders!`}
                    </span>
                  </div>
                  
                  {/* Quick Opponent Preview & Quick Battle Button */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground shrink-0">Top challengers:</p>
                      <div className="flex -space-x-2">
                        {topOpponents.slice(0, 3).map((opponent) => (
                          <img
                            key={opponent.id}
                            src={opponent.image_url}
                            alt={opponent.nickname}
                            title={`${opponent.nickname} (⚡${opponent.power_score})`}
                            className="w-7 h-7 rounded-full border-2 border-background object-cover"
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* Quick Battle Button */}
                    <Button
                      size="sm"
                      className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
                      onClick={handleQuickBattle}
                      disabled={quickBattleLoading}
                    >
                      {quickBattleLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">Quick Battle</span>
                      <span className="sm:hidden">Battle</span>
                    </Button>
                  </div>
                  
                  {/* Suggested Match Preview (shows after clicking Quick Battle) */}
                  {suggestedMatch && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-3 p-3 bg-gradient-to-r from-primary/10 via-amber-500/10 to-primary/10 rounded-lg border border-primary/20"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={suggestedMatch.yourSpider.image_url}
                          alt={suggestedMatch.yourSpider.nickname}
                          className="w-10 h-10 rounded-full border-2 border-primary object-cover"
                        />
                        <div className="text-xs">
                          <p className="font-semibold truncate max-w-[80px]">{suggestedMatch.yourSpider.nickname}</p>
                          <p className="text-muted-foreground">⚡ {suggestedMatch.yourSpider.power_score}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 text-amber-500">
                        <Swords className="h-5 w-5" />
                        <span className="text-xs font-bold">VS</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-right">
                          <p className="font-semibold truncate max-w-[80px]">{suggestedMatch.opponent.nickname}</p>
                          <p className="text-muted-foreground">⚡ {suggestedMatch.opponent.power_score}</p>
                        </div>
                        <img
                          src={suggestedMatch.opponent.image_url}
                          alt={suggestedMatch.opponent.nickname}
                          className="w-10 h-10 rounded-full border-2 border-amber-500 object-cover"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Info Text */}
        <div className="text-center text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 mt-4">
          <p>
            <strong>How it works:</strong> Activate up to 1 spider from your past collection, 
            plus upload up to {activatedSpider ? '2' : '3'} new spiders this week.
            {filledSlots < 3 && (
              <span className="text-primary font-medium"> Fill all 3 slots to maximize your battle potential!</span>
            )}
          </p>
        </div>
      </CardContent>

      {/* Spider Stats Modal */}
      <SpiderDetailsModal
        spider={selectedSpiderForStats ? {
          ...selectedSpiderForStats,
          hit_points: selectedSpiderForStats.hit_points || 0,
          damage: selectedSpiderForStats.damage || 0,
          speed: selectedSpiderForStats.speed || 0,
          defense: selectedSpiderForStats.defense || 0,
          venom: selectedSpiderForStats.venom || 0,
          webcraft: selectedSpiderForStats.webcraft || 0,
          is_approved: selectedSpiderForStats.is_approved ?? true,
        } : null}
        isOpen={isStatsModalOpen}
        onClose={() => {
          setIsStatsModalOpen(false);
          setSelectedSpiderForStats(null);
        }}
      />
    </Card>
  );
};

export default WeeklyEligibleSpiders;
