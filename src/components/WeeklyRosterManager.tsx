import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, Sparkles, Shield, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  created_at?: string;
}

interface RosterSlot {
  slot_number: number;
  spider_id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: string;
}

interface WeeklyRosterManagerProps {
  onRosterChange?: () => void;
  compact?: boolean;
}

const rarityColors: Record<string, string> = {
  COMMON: 'bg-gray-500',
  UNCOMMON: 'bg-green-500',
  RARE: 'bg-blue-500',
  EPIC: 'bg-purple-500',
  LEGENDARY: 'bg-amber-500',
};

const WeeklyRosterManager: React.FC<WeeklyRosterManagerProps> = ({ onRosterChange, compact = false }) => {
  const { user } = useAuth();
  const [roster, setRoster] = useState<RosterSlot[]>([]);
  const [allSpiders, setAllSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRoster();
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

  const fetchRoster = async () => {
    if (!user) return;
    
    try {
      const weekStartStr = getWeekStartStr();
      
      const { data, error } = await (supabase as any)
        .from('weekly_roster')
        .select(`
          slot_number,
          spider_id,
          spiders (
            nickname,
            species,
            image_url,
            power_score,
            rarity
          )
        `)
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr);

      if (error) throw error;
      
      const transformed = (data || []).map((row: any) => ({
        slot_number: row.slot_number,
        spider_id: row.spider_id,
        nickname: row.spiders?.nickname || '',
        species: row.spiders?.species || '',
        image_url: row.spiders?.image_url || '',
        power_score: row.spiders?.power_score || 0,
        rarity: row.spiders?.rarity || 'COMMON',
      }));
      
      setRoster(transformed);
    } catch (error) {
      console.error('Error fetching roster:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSpiders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, power_score, rarity, created_at')
        .eq('owner_id', user.id)
        .eq('is_approved', true)
        .order('power_score', { ascending: false });

      if (error) throw error;
      setAllSpiders((data || []) as Spider[]);
    } catch (error) {
      console.error('Error fetching spiders:', error);
    }
  };

  const handleSetSpider = async (spiderId: string) => {
    if (!user) return;
    
    try {
      const weekStartStr = getWeekStartStr();
      
      // Clear any existing roster entry for this week (only 1 allowed)
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
      await fetchRoster();
      setIsDialogOpen(false);
      onRosterChange?.();
    } catch (error: any) {
      console.error('Error setting roster:', error);
      toast.error(error.message || 'Failed to activate spider');
    }
  };

  const handleRemoveSpider = async () => {
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
      await fetchRoster();
      onRosterChange?.();
    } catch (error: any) {
      console.error('Error removing from roster:', error);
      toast.error(error.message || 'Failed to deactivate spider');
    }
  };

  const activeSpider = roster.find(r => r.slot_number === 1);
  const rosterSpiderIds = new Set(roster.map(r => r.spider_id));
  const availableSpiders = allSpiders.filter(s => !rosterSpiderIds.has(s.id));

  if (!user) return null;

  // Compact version for home page
  if (compact) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Weekly Active Spider</h3>
                <p className="text-xs text-muted-foreground">
                  {activeSpider ? 'Your champion for this week' : 'Select 1 spider from your collection'}
                </p>
              </div>
            </div>
            
            {activeSpider ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <img
                    src={activeSpider.image_url}
                    alt={activeSpider.nickname}
                    className="w-10 h-10 rounded-md object-cover border-2 border-primary/50"
                  />
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium truncate max-w-24">{activeSpider.nickname}</p>
                    <p className="text-xs text-muted-foreground">⚡ {activeSpider.power_score}</p>
                  </div>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <RefreshCcw className="h-3 w-3" />
                      <span className="hidden sm:inline">Change</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Select Weekly Spider
                      </DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                      <div className="space-y-2 pr-4">
                        {allSpiders.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            No spiders available. Upload some spiders first!
                          </p>
                        ) : (
                          allSpiders.map((spider) => (
                            <Card
                              key={spider.id}
                              className={`cursor-pointer hover:ring-2 hover:ring-primary transition-all ${spider.id === activeSpider?.spider_id ? 'ring-2 ring-green-500 bg-green-500/5' : ''}`}
                              onClick={() => handleSetSpider(spider.id)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={spider.image_url}
                                    alt={spider.nickname}
                                    className="w-12 h-12 rounded object-cover"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{spider.nickname}</p>
                                    <p className="text-xs text-muted-foreground truncate">{spider.species}</p>
                                  </div>
                                  <div className="text-right">
                                    <Badge className={`${rarityColors[spider.rarity]} text-white text-[10px]`}>
                                      {spider.rarity}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-1">⚡ {spider.power_score}</p>
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
            ) : (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    Activate Spider
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Select Weekly Spider
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[60vh]">
                    <div className="space-y-2 pr-4">
                      {allSpiders.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No spiders available. Upload some spiders first!
                        </p>
                      ) : (
                        allSpiders.map((spider) => (
                          <Card
                            key={spider.id}
                            className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                            onClick={() => handleSetSpider(spider.id)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={spider.image_url}
                                  alt={spider.nickname}
                                  className="w-12 h-12 rounded object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{spider.nickname}</p>
                                  <p className="text-xs text-muted-foreground truncate">{spider.species}</p>
                                </div>
                                <div className="text-right">
                                  <Badge className={`${rarityColors[spider.rarity]} text-white text-[10px]`}>
                                    {spider.rarity}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">⚡ {spider.power_score}</p>
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
    );
  }

  // Full version for collection page
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Weekly Active Spider</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            Keeper League
          </Badge>
        </div>
        <CardDescription className="text-sm">
          Select 1 spider from your collection to be eligible for battles this week
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          {activeSpider ? (
            <div className="relative group w-full max-w-xs">
              <Card className="overflow-hidden border-2 border-green-500/50 bg-green-500/5">
                <div className="aspect-square relative">
                  <img
                    src={activeSpider.image_url}
                    alt={activeSpider.nickname}
                    className="w-full h-full object-cover"
                  />
                  <Badge 
                    className={`absolute top-2 right-2 ${rarityColors[activeSpider.rarity]} text-white`}
                  >
                    {activeSpider.rarity}
                  </Badge>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 left-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleRemoveSpider}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 text-center">
                  <p className="font-bold text-lg">{activeSpider.nickname}</p>
                  <p className="text-sm text-muted-foreground mb-2">{activeSpider.species}</p>
                  <p className="text-sm">⚡ Power: <span className="font-bold">{activeSpider.power_score}</span></p>
                </div>
              </Card>
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-600 text-white">
                Active This Week
              </Badge>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full mt-4 gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Change Spider
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Select Weekly Spider
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[60vh]">
                    <div className="space-y-2 pr-4">
                      {allSpiders.map((spider) => (
                        <Card
                          key={spider.id}
                          className={`cursor-pointer hover:ring-2 hover:ring-primary transition-all ${spider.id === activeSpider?.spider_id ? 'ring-2 ring-green-500 bg-green-500/5' : ''}`}
                          onClick={() => handleSetSpider(spider.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={spider.image_url}
                                alt={spider.nickname}
                                className="w-12 h-12 rounded object-cover"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{spider.nickname}</p>
                                <p className="text-xs text-muted-foreground truncate">{spider.species}</p>
                              </div>
                              <div className="text-right">
                                <Badge className={`${rarityColors[spider.rarity]} text-white text-[10px]`}>
                                  {spider.rarity}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">⚡ {spider.power_score}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full max-w-xs aspect-square flex flex-col items-center justify-center gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5"
                >
                  <Plus className="h-12 w-12 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Select a Spider</span>
                  <span className="text-xs text-muted-foreground">Activate any spider from your collection</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Select Weekly Spider
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                  <div className="space-y-2 pr-4">
                    {allSpiders.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No spiders available. Upload some spiders first!
                      </p>
                    ) : (
                      allSpiders.map((spider) => (
                        <Card
                          key={spider.id}
                          className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                          onClick={() => handleSetSpider(spider.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={spider.image_url}
                                alt={spider.nickname}
                                className="w-12 h-12 rounded object-cover"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{spider.nickname}</p>
                                <p className="text-xs text-muted-foreground truncate">{spider.species}</p>
                              </div>
                              <div className="text-right">
                                <Badge className={`${rarityColors[spider.rarity]} text-white text-[10px]`}>
                                  {spider.rarity}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">⚡ {spider.power_score}</p>
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
  );
};

export default WeeklyRosterManager;
