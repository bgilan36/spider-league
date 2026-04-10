import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Upload, Sparkles, RefreshCcw, Target, Trophy, Check, Star, BarChart3, Zap, CircleHelp, Clock } from 'lucide-react';
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
  eligible_until?: string;
  last_battled_at?: string;
  hit_points?: number;
  damage?: number;
  speed?: number;
  defense?: number;
  venom?: number;
  webcraft?: number;
  is_approved?: boolean;
  owner_id?: string;
}

interface ActiveSpidersProps {
  onSpiderChange?: () => void;
  newSpiderId?: string;
}

const rarityColors: Record<string, string> = {
  COMMON: 'bg-gray-500',
  UNCOMMON: 'bg-green-500',
  RARE: 'bg-blue-500',
  EPIC: 'bg-purple-500',
  LEGENDARY: 'bg-amber-500',
};

const MAX_ACTIVE = 5;

const ActiveSpiders: React.FC<ActiveSpidersProps> = ({ onSpiderChange, newSpiderId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSpiders, setActiveSpiders] = useState<Spider[]>([]);
  const [expiredSpiders, setExpiredSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReenlistDialogOpen, setIsReenlistDialogOpen] = useState(false);
  const [selectedSpiderForStats, setSelectedSpiderForStats] = useState<Spider | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [activeChallengeSpiderIds, setActiveChallengeSpiderIds] = useState<Set<string>>(new Set());

  const fetchActiveChallenges = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('battle_challenges')
        .select('challenger_spider_id')
        .eq('challenger_id', user.id)
        .eq('status', 'OPEN');
      if (error) throw error;
      setActiveChallengeSpiderIds(new Set((data || []).map(c => c.challenger_spider_id)));
    } catch (error) {
      console.error('Error fetching active challenges:', error);
    }
  };

  const fetchSpiders = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const now = new Date().toISOString();

      // Fetch all user's approved spiders
      const { data, error } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, power_score, rarity, created_at, eligible_until, last_battled_at, hit_points, damage, speed, defense, venom, webcraft, is_approved, owner_id')
        .eq('owner_id', user.id)
        .eq('is_approved', true)
        .order('power_score', { ascending: false });

      if (error) throw error;

      const spiders = (data || []) as Spider[];
      const active = spiders.filter(s => s.eligible_until && new Date(s.eligible_until) > new Date(now));
      const expired = spiders.filter(s => !s.eligible_until || new Date(s.eligible_until) <= new Date(now));

      setActiveSpiders(active);
      setExpiredSpiders(expired);
    } catch (error) {
      console.error('Error fetching spiders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSpiders();
      fetchActiveChallenges();
    }
  }, [user]);

  useEffect(() => {
    const onChallengeCreated = (e: CustomEvent) => {
      const spiderId = e.detail?.challenger_spider_id;
      if (spiderId) setActiveChallengeSpiderIds(prev => new Set([...prev, spiderId]));
    };
    const onChallengeCancelled = (e: CustomEvent) => {
      const spiderId = e.detail?.challenger_spider_id;
      if (spiderId) {
        setActiveChallengeSpiderIds(prev => {
          const s = new Set(prev);
          s.delete(spiderId);
          return s;
        });
      }
    };
    window.addEventListener('challenge:created', onChallengeCreated as EventListener);
    window.addEventListener('challenge:cancelled', onChallengeCancelled as EventListener);
    return () => {
      window.removeEventListener('challenge:created', onChallengeCreated as EventListener);
      window.removeEventListener('challenge:cancelled', onChallengeCancelled as EventListener);
    };
  }, []);

  const handleReenlist = async (spiderId: string) => {
    if (!user) return;
    if (activeSpiders.length >= MAX_ACTIVE) {
      toast.error(`You can only have ${MAX_ACTIVE} active spiders at a time.`);
      return;
    }
    try {
      const newEligibleUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('spiders')
        .update({ eligible_until: newEligibleUntil })
        .eq('id', spiderId)
        .eq('owner_id', user.id);

      if (error) throw error;
      toast.success('Spider re-enlisted for 30 days!');
      setIsReenlistDialogOpen(false);
      await fetchSpiders();
      onSpiderChange?.();
    } catch (error: any) {
      console.error('Error re-enlisting spider:', error);
      toast.error(error.message || 'Failed to re-enlist spider');
    }
  };

  const getDaysRemaining = (eligibleUntil: string) => {
    const diff = new Date(eligibleUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getCooldownMinutes = (lastBattledAt?: string) => {
    if (!lastBattledAt) return 0;
    const diff = Date.now() - new Date(lastBattledAt).getTime();
    const remaining = 60 - Math.floor(diff / (1000 * 60));
    return Math.max(0, remaining);
  };

  if (!user) return null;

  const emptySlots = Math.max(0, MAX_ACTIVE - activeSpiders.length);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 relative overflow-hidden">
      <CardContent className="p-4 sm:p-6 relative z-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-lg">Active Spiders</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Active spiders info"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    <p className="font-semibold mb-1">Active Spiders</p>
                    <p>Each spider stays active for <strong>30 days</strong> from upload. You can have up to {MAX_ACTIVE} active spiders. Expired spiders can be re-enlisted for another 30 days.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {activeSpiders.length}/{MAX_ACTIVE} active • {expiredSpiders.length} expired
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 mb-4">
            {[1,2,3].map(i => (
              <div key={i} className="aspect-[4/3] sm:aspect-square bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 mb-4">
            {/* Active spiders */}
            {activeSpiders.map(spider => {
              const daysLeft = getDaysRemaining(spider.eligible_until!);
              const cooldown = getCooldownMinutes(spider.last_battled_at);
              const hasActiveChallenge = activeChallengeSpiderIds.has(spider.id);

              return (
                <Card 
                  key={spider.id}
                  className={`overflow-hidden border-2 relative ${
                    hasActiveChallenge 
                      ? 'border-primary/70 ring-2 ring-primary/30' 
                      : 'border-green-500/50 bg-green-500/5'
                  }`}
                >
                  {hasActiveChallenge && (
                    <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-[10px] font-semibold py-0.5 px-2 flex items-center justify-center gap-1">
                      <Zap className="h-3 w-3 animate-pulse" />
                      Challenge Active
                    </div>
                  )}
                  
                  <div 
                    className={`aspect-[4/3] sm:aspect-square relative cursor-pointer group ${hasActiveChallenge ? 'mt-5' : ''}`}
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
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-1 text-white text-sm font-medium">
                        <BarChart3 className="h-4 w-4" />
                        View Stats
                      </div>
                    </div>
                    {newSpiderId && spider.id === newSpiderId && (
                      <Badge className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-[10px] animate-pulse">
                        New!
                      </Badge>
                    )}
                  </div>

                  <div className="p-2 sm:p-3">
                    <p className="font-bold text-[11px] sm:text-sm truncate leading-tight">{spider.nickname}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate flex-1 min-w-0">{spider.species}</p>
                      <span className="text-[10px] sm:text-xs font-medium ml-1 shrink-0">⚡{spider.power_score}</span>
                    </div>
                    
                    {/* Days remaining */}
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className={`text-[10px] ${daysLeft <= 3 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                        {daysLeft}d left
                      </span>
                    </div>

                    {/* Cooldown indicator */}
                    {cooldown > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-amber-500" />
                        <span className="text-[10px] text-amber-500 font-medium">
                          Ready in {cooldown}m
                        </span>
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <div className="flex gap-1 mt-1.5 sm:mt-2">
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
                        className="flex-1 h-6 sm:h-7 text-[10px] sm:text-xs gap-1 px-1"
                      />
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: Math.min(emptySlots, MAX_ACTIVE - activeSpiders.length) }).map((_, index) => (
              <Card 
                key={`empty-${index}`}
                className="border-2 border-dashed border-muted-foreground/30 bg-muted/20 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => navigate('/upload')}
                role="button"
                tabIndex={0}
                aria-label="Upload or re-enlist spider"
              >
                <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center min-h-[120px] sm:min-h-[180px] text-center">
                  <div className="p-2 rounded-full bg-primary/10 mb-2">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Add Spider</p>
                  <div className="flex flex-col gap-1.5 w-full">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 w-full text-[10px] sm:text-xs h-7"
                      onClick={(e) => { e.stopPropagation(); navigate('/upload'); }}
                    >
                      <Upload className="h-3 w-3" />
                      Upload
                    </Button>
                    {expiredSpiders.length > 0 && (
                      <Dialog open={isReenlistDialogOpen} onOpenChange={setIsReenlistDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 w-full text-[10px] sm:text-xs h-7 text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <RefreshCcw className="h-3 w-3" />
                            Re-enlist
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Sparkles className="h-5 w-5 text-primary" />
                              Re-enlist Spider
                            </DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground mb-4">
                            Choose an expired spider to re-activate for 30 more days.
                          </p>
                          <ScrollArea className="max-h-[60vh]">
                            <div className="space-y-2 pr-4">
                              {expiredSpiders.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                  No expired spiders available.
                                </p>
                              ) : (
                                expiredSpiders.map((s) => (
                                  <Card
                                    key={s.id}
                                    className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                    onClick={() => handleReenlist(s.id)}
                                  >
                                    <CardContent className="p-3">
                                      <div className="flex items-center gap-3">
                                        <img src={s.image_url} alt={s.nickname} className="w-12 h-12 rounded object-cover" />
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
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Text */}
        <div className="text-center text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <p>
            <strong>How it works:</strong> Each spider stays active for 30 days from upload. 
            You can have up to {MAX_ACTIVE} active spiders. Expired spiders can be re-enlisted for another 30 days.
          </p>
        </div>
      </CardContent>

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

export default ActiveSpiders;
