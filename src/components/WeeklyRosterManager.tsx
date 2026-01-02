import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings2, Plus, X, Sparkles, Shield } from 'lucide-react';
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
}

const rarityColors: Record<string, string> = {
  COMMON: 'bg-gray-500',
  UNCOMMON: 'bg-green-500',
  RARE: 'bg-blue-500',
  EPIC: 'bg-purple-500',
  LEGENDARY: 'bg-amber-500',
};

const WeeklyRosterManager: React.FC<WeeklyRosterManagerProps> = ({ onRosterChange }) => {
  const { user } = useAuth();
  const [roster, setRoster] = useState<RosterSlot[]>([]);
  const [allSpiders, setAllSpiders] = useState<Spider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRoster();
      fetchAllSpiders();
    }
  }, [user]);

  const fetchRoster = async () => {
    if (!user) return;
    
    try {
      // Get current week start (Sunday)
      const ptNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dayOfWeek = ptNow.getDay();
      const weekStart = new Date(ptNow);
      weekStart.setDate(ptNow.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      // Use type cast since weekly_roster table types aren't generated yet
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
      
      // Transform the data to match our interface
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
        .select('id, nickname, species, image_url, power_score, rarity')
        .eq('owner_id', user.id)
        .eq('is_approved', true)
        .order('power_score', { ascending: false });

      if (error) throw error;
      setAllSpiders((data || []) as Spider[]);
    } catch (error) {
      console.error('Error fetching spiders:', error);
    }
  };

  const handleSetSlot = async (spiderId: string, slot: number) => {
    if (!user) return;
    
    try {
      // Get current week start (Sunday)
      const ptNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dayOfWeek = ptNow.getDay();
      const weekStart = new Date(ptNow);
      weekStart.setDate(ptNow.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      // First, remove spider from any existing slot this week
      await (supabase as any)
        .from('weekly_roster')
        .delete()
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .eq('spider_id', spiderId);
      
      // Delete any existing spider in this slot
      await (supabase as any)
        .from('weekly_roster')
        .delete()
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .eq('slot_number', slot);
      
      // Insert the roster entry
      const { error } = await (supabase as any)
        .from('weekly_roster')
        .insert({
          user_id: user.id,
          week_start: weekStartStr,
          spider_id: spiderId,
          slot_number: slot,
        });

      if (error) throw error;
      
      toast.success('Spider added to weekly roster!');
      await fetchRoster();
      setIsDialogOpen(false);
      setSelectedSlot(null);
      onRosterChange?.();
    } catch (error: any) {
      console.error('Error setting roster slot:', error);
      toast.error(error.message || 'Failed to update roster');
    }
  };

  const handleRemoveFromSlot = async (slot: number) => {
    if (!user) return;
    
    try {
      // Get current week start (Sunday)
      const ptNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dayOfWeek = ptNow.getDay();
      const weekStart = new Date(ptNow);
      weekStart.setDate(ptNow.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      const { error } = await (supabase as any)
        .from('weekly_roster')
        .delete()
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .eq('slot_number', slot);

      if (error) throw error;
      
      toast.success('Spider removed from roster');
      await fetchRoster();
      onRosterChange?.();
    } catch (error: any) {
      console.error('Error removing from roster:', error);
      toast.error(error.message || 'Failed to remove from roster');
    }
  };

  const getSlotSpider = (slotNumber: number) => {
    return roster.find(r => r.slot_number === slotNumber);
  };

  const rosterSpiderIds = new Set(roster.map(r => r.spider_id));
  const availableSpiders = allSpiders.filter(s => !rosterSpiderIds.has(s.id));

  if (!user) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Weekly Roster</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            Keeper League
          </Badge>
        </div>
        <CardDescription className="text-sm">
          Select up to 3 spiders from your collection to battle this week
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((slotNum) => {
            const slotSpider = getSlotSpider(slotNum);
            
            return (
              <div key={slotNum} className="relative">
                {slotSpider ? (
                  <div className="relative group">
                    <Card className="overflow-hidden border-2 border-green-500/50 bg-green-500/5">
                      <div className="aspect-square relative">
                        <img
                          src={slotSpider.image_url}
                          alt={slotSpider.nickname}
                          className="w-full h-full object-cover"
                        />
                        <Badge 
                          className={`absolute top-1 right-1 text-[10px] ${rarityColors[slotSpider.rarity]} text-white`}
                        >
                          {slotSpider.rarity?.slice(0, 3)}
                        </Badge>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 left-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveFromSlot(slotNum)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="p-2 text-center">
                        <p className="text-xs font-medium truncate">{slotSpider.nickname}</p>
                        <p className="text-[10px] text-muted-foreground">⚡ {slotSpider.power_score}</p>
                      </div>
                    </Card>
                    <Badge className="absolute -top-2 -left-2 h-5 w-5 p-0 flex items-center justify-center bg-green-600 text-[10px]">
                      {slotNum}
                    </Badge>
                  </div>
                ) : (
                  <Dialog open={isDialogOpen && selectedSlot === slotNum} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) setSelectedSlot(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full aspect-square flex flex-col items-center justify-center gap-1 border-dashed border-2 hover:border-primary hover:bg-primary/5"
                        onClick={() => setSelectedSlot(slotNum)}
                      >
                        <Plus className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Slot {slotNum}</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          Select Spider for Slot {slotNum}
                        </DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[60vh]">
                        <div className="space-y-2 pr-4">
                          {availableSpiders.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                              No available spiders. Upload some spiders first!
                            </p>
                          ) : (
                            availableSpiders.map((spider) => (
                              <Card
                                key={spider.id}
                                className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                onClick={() => handleSetSlot(spider.id, slotNum)}
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
            );
          })}
        </div>
        
        {roster.length > 0 && (
          <div className="mt-3 pt-3 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Total Power: <span className="font-bold text-foreground">
                {roster.reduce((sum, r) => sum + r.power_score, 0)}
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyRosterManager;
