import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Plus, Upload, Sparkles, RefreshCcw, Target, Trophy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  created_at?: string;
  source?: 'activated' | 'uploaded';
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

  useEffect(() => {
    if (user) {
      fetchEligibleSpiders();
      fetchAllSpiders();
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
            created_at
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
        .select('id, nickname, species, image_url, power_score, rarity, created_at')
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
        .select('id, nickname, species, image_url, power_score, rarity, created_at')
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

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">This Week's Eligible Spiders</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Build your battle roster: {filledSlots}/3 slots filled
              </p>
            </div>
          </div>
          
          {filledSlots === 3 && (
            <Badge className="bg-green-600 text-white gap-1 self-start sm:self-auto">
              <Check className="h-3 w-3" />
              Roster Complete!
            </Badge>
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
              // Empty slot
              const canActivate = index === 0 && !activatedSpider && allSpiders.length > 0;
              const canUpload = isUploadSlot || (index === 0 && allSpiders.length === 0);
              
              return (
                <Card 
                  key={index}
                  className="border-2 border-dashed border-muted-foreground/30 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <CardContent className="p-4 flex flex-col items-center justify-center min-h-[180px] text-center">
                    {canActivate ? (
                      <>
                        <div className="p-3 rounded-full bg-primary/10 mb-3">
                          <RefreshCcw className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Activate Past Spider</p>
                        <p className="text-xs text-muted-foreground/70 mb-3">Choose 1 from collection</p>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Plus className="h-4 w-4" />
                              Activate
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
                      </>
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-primary/10 mb-3">
                          <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Upload New Spider</p>
                        <p className="text-xs text-muted-foreground/70 mb-3">
                          {maxUploads - uploadedSpiders.length > 0 
                            ? `${maxUploads - uploadedSpiders.length} upload${maxUploads - uploadedSpiders.length > 1 ? 's' : ''} remaining`
                            : 'Limit reached'}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => navigate('/upload')}
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
                <div className="aspect-square relative">
                  <img
                    src={spider.image_url}
                    alt={spider.nickname}
                    className="w-full h-full object-cover"
                  />
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
                  <p className="text-xs">⚡ {spider.power_score}</p>
                  {spider.source === 'activated' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 text-xs h-7 text-muted-foreground hover:text-destructive"
                      onClick={handleDeactivateSpider}
                    >
                      Change
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Info Text */}
        <div className="text-center text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <p>
            <strong>How it works:</strong> Activate up to 1 spider from your past collection, 
            plus upload up to {activatedSpider ? '2' : '3'} new spiders this week.
            {filledSlots < 3 && (
              <span className="text-primary font-medium"> Fill all 3 slots to maximize your battle potential!</span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyEligibleSpiders;
