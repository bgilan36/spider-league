import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Upload, Sparkles, RefreshCcw, Target, Check, BarChart3, Zap, CircleHelp, Clock, Sword, Skull, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import SpiderDetailsModal from '@/components/SpiderDetailsModal';

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
const COOLDOWN_MINUTES = 60;

const ActiveSpiders: React.FC<ActiveSpidersProps> = ({ onSpiderChange, newSpiderId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSpiders, setActiveSpiders] = useState<Spider[]>([]);
  const [expiredSpiders, setExpiredSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReenlistDialogOpen, setIsReenlistDialogOpen] = useState(false);
  const [selectedSpiderForStats, setSelectedSpiderForStats] = useState<Spider | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [battleLoadingId, setBattleLoadingId] = useState<string | null>(null);

  // Battle preview state
  const [showBattlePreview, setShowBattlePreview] = useState(false);
  const [battlePreviewSpider, setBattlePreviewSpider] = useState<Spider | null>(null);
  const [battlePreviewOpponent, setBattlePreviewOpponent] = useState<Spider | null>(null);
  const [battlePreviewLoading, setBattlePreviewLoading] = useState(false);
  const [battleStarting, setBattleStarting] = useState(false);

  // Opponent browser state
  const [showOpponentBrowser, setShowOpponentBrowser] = useState(false);
  const [opponentBrowserSpider, setOpponentBrowserSpider] = useState<Spider | null>(null);
  const [opponents, setOpponents] = useState<(Spider & { owner_name?: string })[]>([]);
  const [opponentsLoading, setOpponentsLoading] = useState(false);

  const fetchSpiders = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const now = new Date().toISOString();
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
    if (user) fetchSpiders();
  }, [user]);

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
    const remaining = COOLDOWN_MINUTES - Math.floor(diff / (1000 * 60));
    return Math.max(0, remaining);
  };

  const handleBattleNow = async (spider: Spider) => {
    if (!user) return;
    const cooldown = getCooldownMinutes(spider.last_battled_at);
    if (cooldown > 0) {
      toast.error(`This spider is on cooldown. Ready in ${cooldown} minutes.`);
      return;
    }
    // Fetch a preview opponent first
    setBattlePreviewSpider(spider);
    setBattlePreviewLoading(true);
    setBattlePreviewOpponent(null);
    setShowBattlePreview(true);
    try {
      const bands = [0.12, 0.20, 0.35, 0.55, 1.0];
      let found: Spider | null = null;
      for (const pct of bands) {
        const low = Math.floor(spider.power_score * (1.0 - pct));
        const high = Math.ceil(spider.power_score * (1.0 + pct));
        const { data } = await supabase
          .from('spiders')
          .select('id, nickname, species, image_url, power_score, rarity, hit_points, damage, speed, defense, venom, webcraft, owner_id')
          .eq('is_approved', true)
          .neq('owner_id', user.id)
          .gte('power_score', low)
          .lte('power_score', high)
          .limit(10);
        if (data && data.length > 0) {
          found = data[Math.floor(Math.random() * data.length)] as Spider;
          break;
        }
      }
      if (!found) {
        // Fallback: any spider
        const { data } = await supabase
          .from('spiders')
          .select('id, nickname, species, image_url, power_score, rarity, hit_points, damage, speed, defense, venom, webcraft, owner_id')
          .eq('is_approved', true)
          .neq('owner_id', user.id)
          .order('power_score', { ascending: false })
          .limit(1);
        if (data && data.length > 0) found = data[0] as Spider;
      }
      setBattlePreviewOpponent(found);
    } catch (error) {
      console.error('Error fetching opponent preview:', error);
      toast.error('Failed to find an opponent');
      setShowBattlePreview(false);
    } finally {
      setBattlePreviewLoading(false);
    }
  };

  const handleConfirmBattle = async () => {
    if (!user || !battlePreviewSpider) return;
    setBattleStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('quick-battle', {
        body: { spiderId: battlePreviewSpider.id }
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.battleId) {
        setShowBattlePreview(false);
        toast.success('Battle Complete! Viewing results...');
        navigate(`/battle/${data.battleId}`);
      }
    } catch (error: any) {
      console.error('Quick battle error:', error);
      toast.error(error.message || 'Failed to start battle');
    } finally {
      setBattleStarting(false);
    }
  };

  const handleOpenOpponentBrowser = async (spider: Spider) => {
    setOpponentBrowserSpider(spider);
    setShowOpponentBrowser(true);
    setOpponentsLoading(true);
    try {
      const lowerBound = Math.floor(spider.power_score * 0.7);
      const upperBound = Math.ceil(spider.power_score * 1.3);
      const { data, error } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, power_score, rarity, hit_points, damage, speed, defense, venom, webcraft, is_approved, owner_id, eligible_until')
        .eq('is_approved', true)
        .neq('owner_id', user!.id)
        .gte('power_score', lowerBound)
        .lte('power_score', upperBound)
        .gt('eligible_until', new Date().toISOString())
        .order('power_score', { ascending: false })
        .limit(20);
      if (error) throw error;

      // Fetch owner display names
      const ownerIds = [...new Set((data || []).map(s => s.owner_id))];
      let ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ownerIds);
        (profiles || []).forEach(p => { ownerMap[p.id] = p.display_name || 'Unknown'; });
      }
      setOpponents((data || []).map(s => ({ ...s, owner_name: ownerMap[s.owner_id] || 'Unknown' } as any)));
    } catch (error) {
      console.error('Error fetching opponents:', error);
      toast.error('Failed to load opponents');
    } finally {
      setOpponentsLoading(false);
    }
  };

  const handleChallengeOpponent = async (opponentSpider: Spider) => {
    if (!user || !opponentBrowserSpider) return;
    try {
      // First, cancel any existing open challenge for this spider and wait for confirmation
      const { error: cancelError } = await supabase
        .from('battle_challenges')
        .delete()
        .eq('challenger_id', user.id)
        .eq('challenger_spider_id', opponentBrowserSpider.id)
        .eq('status', 'OPEN');

      if (cancelError) {
        console.warn('Error clearing old challenge:', cancelError);
      }

      // Small delay to ensure the delete is committed before inserting
      await new Promise(resolve => setTimeout(resolve, 300));

      const { error } = await supabase
        .from('battle_challenges')
        .insert({
          challenger_id: user.id,
          challenger_spider_id: opponentBrowserSpider.id,
          accepter_spider_id: opponentSpider.id,
          is_all_or_nothing: true,
          challenge_message: `${opponentBrowserSpider.nickname} challenges ${opponentSpider.nickname} to a Battle to the Death!`,
          status: 'OPEN',
        });
      if (error) throw error;
      toast.success(`Battle to the Death challenge sent! Waiting for ${opponentSpider.nickname}'s owner to accept.`);
      setShowOpponentBrowser(false);
      window.dispatchEvent(new CustomEvent('challenge:created', { detail: { challenger_spider_id: opponentBrowserSpider.id } }));
    } catch (error: any) {
      console.error('Error creating challenge:', error);
      toast.error(error.message || 'Failed to send challenge');
    }
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
                <h3 className="font-bold text-lg">Your Starting 5</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Starting 5 info"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    <p className="font-semibold mb-1">Your Starting 5</p>
                    <p>Each spider stays active for <strong>30 days</strong> from upload. You can have up to {MAX_ACTIVE} active spiders.</p>
                    <p className="mt-1"><strong>Battle Now</strong> — Training battle for XP (no risk).</p>
                    <p><strong>Battle to Death</strong> — Winner takes the loser's spider. Both sides must agree.</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 mb-4">
            {[1,2,3].map(i => (
              <div key={i} className="aspect-[3/4] bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 mb-4">
            {activeSpiders.map(spider => {
              const daysLeft = getDaysRemaining(spider.eligible_until!);
              const cooldown = getCooldownMinutes(spider.last_battled_at);
              const isBattling = battleLoadingId === spider.id;
              const onCooldown = cooldown > 0;

              return (
                <Card
                  key={spider.id}
                  className="overflow-hidden border-2 border-green-500/50 bg-green-500/5 relative"
                >
                  <div
                    className="aspect-[4/3] relative cursor-pointer group"
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

                    {/* Cooldown */}
                    {onCooldown && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-amber-500" />
                        <span className="text-[10px] text-amber-500 font-medium">
                          Ready in {cooldown}m
                        </span>
                      </div>
                    )}

                    {/* Battle buttons */}
                    <div className="flex flex-col gap-1 mt-1.5 sm:mt-2">
                      <Button
                        size="sm"
                        className={`w-full h-7 text-[10px] sm:text-xs gap-1 ${spider.id === newSpiderId ? 'animate-pulse shadow-glow ring-2 ring-primary' : ''}`}
                        disabled={onCooldown || isBattling}
                        onClick={() => handleBattleNow(spider)}
                      >
                        {isBattling ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Battling...</>
                        ) : (
                          <><Sword className="h-3 w-3" /> Battle Now</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-[10px] sm:text-xs gap-1 border-red-400/50 text-red-400 hover:bg-red-400/10"
                        disabled={onCooldown || isBattling}
                        onClick={() => handleOpenOpponentBrowser(spider)}
                      >
                        <Skull className="h-3 w-3" />
                        Battle to Death
                      </Button>
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
                <CardContent className="p-2 sm:p-4 flex flex-col items-center justify-center min-h-[180px] sm:min-h-[240px] text-center">
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
                            <DialogDescription>
                              Choose an expired spider to re-activate for 30 more days.
                            </DialogDescription>
                          </DialogHeader>
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
            You can have up to {MAX_ACTIVE} active spiders. <strong>Battle Now</strong> is a training fight for XP. <strong>Battle to Death</strong> means the winner takes the loser's spider — both sides must agree.
          </p>
        </div>
      </CardContent>

      {/* Opponent Browser Dialog for Battle to Death */}
      <Dialog open={showOpponentBrowser} onOpenChange={setShowOpponentBrowser}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-destructive" />
              Battle to the Death — Choose Opponent
            </DialogTitle>
            <DialogDescription>
              {opponentBrowserSpider && (
                <>Challenging with <strong>{opponentBrowserSpider.nickname}</strong> (⚡{opponentBrowserSpider.power_score}). The opponent's owner must accept before the battle begins. The loser's spider transfers to the winner.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {opponentsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : opponents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No eligible opponents found in a similar power range. Try again later.
              </p>
            ) : (
              <div className="space-y-2 pr-4">
                {opponents.map((opp) => (
                  <Card
                    key={opp.id}
                    className="cursor-pointer hover:ring-2 hover:ring-destructive/50 transition-all"
                    onClick={() => handleChallengeOpponent(opp)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={opp.image_url} alt={opp.nickname} className="w-14 h-14 rounded object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{opp.nickname}</p>
                          <p className="text-xs text-muted-foreground truncate">{opp.species}</p>
                          <p className="text-[10px] text-muted-foreground">Owner: {opp.owner_name}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <Badge className={`${rarityColors[opp.rarity]} text-white text-[10px]`}>
                            {opp.rarity}
                          </Badge>
                          <p className="text-xs font-semibold">⚡ {opp.power_score}</p>
                          <Button size="sm" variant="destructive" className="h-6 text-[10px] gap-1 mt-1">
                            <Skull className="h-3 w-3" />
                            Challenge
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Battle Now Preview Dialog */}
      <Dialog open={showBattlePreview} onOpenChange={(open) => { if (!battleStarting) setShowBattlePreview(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sword className="h-5 w-5 text-primary" />
              Training Battle — Matchup Preview
            </DialogTitle>
            <DialogDescription>
              Review the matchup below. No spiders are lost — this is a training fight for XP and stat boosts.
            </DialogDescription>
          </DialogHeader>

          {battlePreviewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Finding opponent...</span>
            </div>
          ) : battlePreviewSpider && battlePreviewOpponent ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* Your spider */}
                <div className="flex flex-col items-center text-center">
                  <img src={battlePreviewSpider.image_url} alt={battlePreviewSpider.nickname} className="w-20 h-20 rounded-lg object-cover border-2 border-primary/40" />
                  <p className="font-bold text-sm mt-2 truncate max-w-[100px]">{battlePreviewSpider.nickname}</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{battlePreviewSpider.species}</p>
                  <Badge className="mt-1 text-[10px]">⚡ {battlePreviewSpider.power_score}</Badge>
                  <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5 text-left">
                    <p>❤️ {battlePreviewSpider.hit_points} HP</p>
                    <p>⚔️ {battlePreviewSpider.damage} DMG</p>
                    <p>🛡️ {battlePreviewSpider.defense} DEF</p>
                    <p>💨 {battlePreviewSpider.speed} SPD</p>
                    <p>☠️ {battlePreviewSpider.venom} VNM</p>
                  </div>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black text-primary">VS</span>
                </div>

                {/* Opponent */}
                <div className="flex flex-col items-center text-center">
                  <img src={battlePreviewOpponent.image_url} alt={battlePreviewOpponent.nickname} className="w-20 h-20 rounded-lg object-cover border-2 border-destructive/40" />
                  <p className="font-bold text-sm mt-2 truncate max-w-[100px]">{battlePreviewOpponent.nickname}</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{battlePreviewOpponent.species}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">⚡ {battlePreviewOpponent.power_score}</Badge>
                  <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5 text-left">
                    <p>❤️ {battlePreviewOpponent.hit_points} HP</p>
                    <p>⚔️ {battlePreviewOpponent.damage} DMG</p>
                    <p>🛡️ {battlePreviewOpponent.defense} DEF</p>
                    <p>💨 {battlePreviewOpponent.speed} SPD</p>
                    <p>☠️ {battlePreviewOpponent.venom} VNM</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowBattlePreview(false)} disabled={battleStarting}>
                  Cancel
                </Button>
                <Button className="flex-1 gap-1" onClick={handleConfirmBattle} disabled={battleStarting}>
                  {battleStarting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Starting...</>
                  ) : (
                    <><Sword className="h-4 w-4" /> Start Battle</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No opponents found. Try again later.</p>
          )}
        </DialogContent>
      </Dialog>

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
