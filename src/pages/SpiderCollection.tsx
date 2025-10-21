import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trophy, Zap, Shield, Target, Droplet, Globe, ArrowUpDown, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import PowerScoreArc from "@/components/PowerScoreArc";
import BattleButton from "@/components/BattleButton";
import BattleDetailsModal from "@/components/BattleDetailsModal";
import SpiderDetailsModal from "@/components/SpiderDetailsModal";
import ClickableUsername from "@/components/ClickableUsername";

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "UNCOMMON";
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  power_score: number;
  is_approved: boolean;
  owner_id?: string;
  created_at: string;
  is_eligible?: boolean;
  battle_won_from?: {
    battle_id: string;
    defeated_user: string;
    defeated_user_display_name?: string;
  };
  lost_to?: {
    battle_id: string;
    new_owner_id: string;
    new_owner_display_name?: string;
  };
}

const SpiderCollection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [spiders, setSpiders] = useState<Spider[]>([]);
  const [fallenHeroes, setFallenHeroes] = useState<Spider[]>([]);
  const [sortBy, setSortBy] = useState<"newest" | "power_score" | "recent">("newest");
  const [loading, setLoading] = useState(true);
  const [selectedBattle, setSelectedBattle] = useState<any>(null);
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [selectedSpider, setSelectedSpider] = useState<Spider | null>(null);
  const [showSpiderModal, setShowSpiderModal] = useState(false);

  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500",
    RARE: "bg-blue-500", 
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500"
  };

  const statIcons = {
    hit_points: Trophy,
    damage: Target,
    speed: Zap,
    defense: Shield,
    venom: Droplet,
    webcraft: Globe
  };

  useEffect(() => {
    fetchSpiders();

    // Set up real-time subscription for spider ownership changes
    const channel = supabase
      .channel('spider-ownership-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'spiders',
        filter: `owner_id=eq.${user?.id}`
      }, () => {
        console.log('Spider ownership changed, refreshing collection...');
        fetchSpiders();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'spiders',
        filter: `owner_id=eq.${user?.id}`
      }, () => {
        console.log('New spider added, refreshing collection...');
        fetchSpiders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchSpiders = async () => {
    if (!user) return;
    
    try {
      // Fetch user's spiders (including unapproved ones)
      const { data: userSpiders, error: userError } = await supabase
        .from('spiders')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (userError) throw userError;

      // Get current week start in Pacific Time (same as Index.tsx)
      const ptNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dayOfWeek = ptNow.getDay(); // 0 = Sunday
      
      // Calculate Sunday of current week in PT (week starts on Sunday)
      const weekStart = new Date(ptNow);
      weekStart.setDate(ptNow.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartISO = weekStart.toISOString();

      // Identify spiders uploaded this week (first 3 are eligible)
      const eligibleSpiderIds = new Set(
        (userSpiders || [])
          .filter(spider => spider.created_at && new Date(spider.created_at) >= weekStart)
          .slice(0, 3)
          .map(spider => spider.id)
      );

      // Fetch battle information for spiders won through battles
      const { data: battleChallenges, error: battleError } = await supabase
        .from('battle_challenges')
        .select(`
          loser_spider_id,
          battle_id,
          challenger_id
        `)
        .eq('winner_id', user.id)
        .eq('status', 'COMPLETED')
        .not('loser_spider_id', 'is', null);

      if (battleError) throw battleError;

      // Get unique challenger IDs to fetch their profiles
      const challengerIds = [...new Set(battleChallenges?.map(bc => bc.challenger_id) || [])];
      const { data: challengerProfiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', challengerIds);

      // Combine spider data with battle attribution and eligibility status
      const spidersWithAttribution = (userSpiders || []).map(spider => {
        const battleInfo = battleChallenges?.find(bc => bc.loser_spider_id === spider.id);
        const isEligible = eligibleSpiderIds.has(spider.id);
        
        if (battleInfo) {
          const challengerProfile = challengerProfiles?.find(p => p.id === battleInfo.challenger_id);
          return {
            ...spider,
            is_eligible: isEligible,
            battle_won_from: {
              battle_id: battleInfo.battle_id,
              defeated_user: battleInfo.challenger_id,
              defeated_user_display_name: challengerProfile?.display_name
            }
          };
        }
        return {
          ...spider,
          is_eligible: isEligible
        };
      });

      setSpiders(spidersWithAttribution);

      // Fetch fallen heroes (spiders lost in battles)
      const { data: lostBattles, error: lostError } = await supabase
        .from('battle_challenges')
        .select(`
          loser_spider_id,
          battle_id,
          winner_id,
          challenger_id,
          accepter_id
        `)
        .eq('status', 'COMPLETED')
        .not('loser_spider_id', 'is', null);

      if (lostError) throw lostError;

      // Filter for battles where current user lost their spider
      const userLostBattles = lostBattles?.filter(battle => {
        const isUserChallenger = battle.challenger_id === user.id;
        const isUserAccepter = battle.accepter_id === user.id;
        const didUserLose = battle.winner_id !== user.id;
        return (isUserChallenger || isUserAccepter) && didUserLose;
      }) || [];

      // Get spider IDs that were lost
      const lostSpiderIds = userLostBattles.map(battle => battle.loser_spider_id);

      if (lostSpiderIds.length > 0) {
        // Fetch the fallen spider details
        const { data: lostSpiders, error: lostSpidersError } = await supabase
          .from('spiders')
          .select('*')
          .in('id', lostSpiderIds);

        if (lostSpidersError) throw lostSpidersError;

        // Get new owner IDs
        const newOwnerIds = [...new Set(userLostBattles.map(b => b.winner_id))];
        const { data: newOwnerProfiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', newOwnerIds);

        // Combine lost spider data with new owner info
        const fallenHeroesWithInfo = (lostSpiders || []).map(spider => {
          const battleInfo = userLostBattles.find(b => b.loser_spider_id === spider.id);
          if (battleInfo) {
            const newOwnerProfile = newOwnerProfiles?.find(p => p.id === battleInfo.winner_id);
            return {
              ...spider,
              lost_to: {
                battle_id: battleInfo.battle_id,
                new_owner_id: battleInfo.winner_id,
                new_owner_display_name: newOwnerProfile?.display_name
              }
            };
          }
          return spider;
        });

        setFallenHeroes(fallenHeroesWithInfo);
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load spiders.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewBattleDetails = async (battleId: string) => {
    try {
      const { data: battle, error } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .single();

      if (error) throw error;
      
      setSelectedBattle(battle);
      setShowBattleModal(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load battle details",
        variant: "destructive"
      });
    }
  };

  const handleSpiderClick = (spider: Spider) => {
    setSelectedSpider(spider);
    setShowSpiderModal(true);
  };

  const getSortedSpiders = () => {
    if (!spiders.length) return [];
    
    const sortedSpiders = [...spiders];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    switch (sortBy) {
      case "power_score":
        return sortedSpiders.sort((a, b) => b.power_score - a.power_score);
      case "recent":
        return sortedSpiders.filter(spider => 
          new Date(spider.created_at) >= oneWeekAgo
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "newest":
      default:
        return sortedSpiders.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  };

  const SpiderCard = ({ spider, isFallenHero = false }: { spider: Spider; isFallenHero?: boolean }) => (
    <Card className={`overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${isFallenHero ? 'opacity-75 border-red-900/20' : ''}`} onClick={() => handleSpiderClick(spider)}>
      <div className="aspect-square relative">
        <img 
          src={spider.image_url}
          alt={spider.nickname}
          className={`w-full h-full object-cover ${isFallenHero ? 'grayscale' : ''}`}
        />
        <Badge 
          className={`absolute top-2 right-2 ${rarityColors[spider.rarity]} text-white`}
        >
          {spider.rarity}
        </Badge>
        {spider.is_eligible && !isFallenHero && (
          <Badge 
            className="absolute top-2 left-2 bg-green-600 text-white"
          >
            Eligible
          </Badge>
        )}
      </div>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{spider.nickname}</CardTitle>
        <CardDescription>{spider.species}</CardDescription>
        <div className="flex justify-center mt-2">
          <PowerScoreArc score={spider.power_score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          A powerful {spider.species.toLowerCase()} with exceptional {spider.venom > 70 ? 'venom production' : spider.webcraft > 70 ? 'web crafting abilities' : spider.speed > 70 ? 'agility and speed' : spider.defense > 70 ? 'defensive capabilities' : 'combat prowess'}. This spider excels in battle with its {spider.damage > 70 ? 'devastating attacks' : spider.hit_points > 70 ? 'incredible endurance' : 'balanced fighting style'}.
        </p>
        {Object.entries(statIcons).map(([stat, Icon]) => (
          <div key={stat} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="capitalize">{stat.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1 ml-2">
              <Progress 
                value={(spider[stat as keyof Spider] as number) / 100 * 100} 
                className="flex-1"
              />
              <span className="text-xs font-medium w-8 text-right">
                {spider[stat as keyof Spider] as number}
              </span>
            </div>
          </div>
        ))}
        
        {spider.battle_won_from && !isFallenHero && (
          <div className="pt-3 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewBattleDetails(spider.battle_won_from!.battle_id);
              }}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors p-2 rounded-md hover:bg-muted/50"
            >
               <Swords className="h-3 w-3" />
               Won from <ClickableUsername 
                 userId={spider.battle_won_from.defeated_user}
                 displayName={spider.battle_won_from.defeated_user_display_name}
                 variant="link"
                 size="sm"
                 className="text-xs p-0 h-auto"
               /> in battle
            </button>
          </div>
        )}

        {spider.lost_to && isFallenHero && (
          <div className="pt-3 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewBattleDetails(spider.lost_to!.battle_id);
              }}
              className="w-full flex items-center justify-center gap-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-2 rounded-md hover:bg-muted/50"
            >
               <Swords className="h-3 w-3" />
               Lost to <ClickableUsername 
                 userId={spider.lost_to.new_owner_id}
                 displayName={spider.lost_to.new_owner_display_name}
                 variant="link"
                 size="sm"
                 className="text-xs p-0 h-auto text-red-600 dark:text-red-400"
               /> in battle
            </button>
          </div>
        )}
        
        {!isFallenHero && spider.is_eligible && (
          <div className="pt-4 border-t flex justify-center">
            <BattleButton 
              targetSpider={{...spider, owner_id: spider.owner_id || user?.id}} 
              size="sm" 
              variant="outline"
              context="collection"
              className="w-full"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading spiders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Helmet>
        <title>Spider Collection — Spider League</title>
        <meta name="description" content="View your spider collection and discover other fighters in Spider League." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="canonical" href={`${window.location.origin}/collection`} />
      </Helmet>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-safe">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              ← <span className="hidden sm:inline">Home</span>
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-xs sm:text-sm font-medium">Collection</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <img 
              src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
              alt="Spider League Logo" 
              className="h-10 sm:h-12 w-auto flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2 truncate">My Spider Collection</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Current fighters: {spiders.length}
                {fallenHeroes.length > 0 && ` • Fallen heroes: ${fallenHeroes.length}`}
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link to="/upload">
              <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Upload Spider</span>
              <span className="sm:hidden">Upload</span>
            </Link>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="text-xs sm:text-sm font-medium">Sort by:</span>
          </div>
          <Select value={sortBy} onValueChange={(value: "newest" | "power_score" | "recent") => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">All Spiders (Newest First)</SelectItem>
              <SelectItem value="power_score">All Spiders (Strongest First)</SelectItem>
              <SelectItem value="recent">Past Week Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {spiders.length === 0 && fallenHeroes.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">You haven't uploaded any spiders yet.</p>
              <Button asChild>
                <Link to="/upload">
                  <Plus className="mr-2 h-4 w-4" />
                  Upload Your First Spider
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Eligible Spiders Section */}
            <div className="mb-12">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Eligible Spiders</h2>
                <p className="text-muted-foreground text-sm">These spiders can compete in battles this week</p>
              </div>
              {spiders.filter(s => s.is_eligible).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {getSortedSpiders().filter(s => s.is_eligible).map((spider) => (
                    <SpiderCard key={spider.id} spider={spider} isFallenHero={false} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-muted-foreground mb-4">
                      You don't have any eligible spiders this week. Upload a new spider to start battling!
                    </p>
                    <Button asChild>
                      <Link to="/upload">
                        <Plus className="mr-2 h-4 w-4" />
                        Upload Spider to Battle
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Ineligible Spiders Section */}
            {spiders.filter(s => !s.is_eligible).length > 0 && (
              <div className="mb-12">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Ineligible Spiders</h2>
                  <p className="text-muted-foreground text-sm">These spiders cannot compete this week</p>
                </div>
                {sortBy === "recent" && getSortedSpiders().filter(s => !s.is_eligible).length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <p className="text-muted-foreground">No ineligible spiders from the past week.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {getSortedSpiders().filter(s => !s.is_eligible).map((spider) => (
                      <SpiderCard key={spider.id} spider={spider} isFallenHero={false} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fallen Heroes Section */}
            {fallenHeroes.length > 0 && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Fallen Heroes</h2>
                  <p className="text-muted-foreground text-sm">Spiders that were defeated and transferred to other trainers</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {fallenHeroes.map((spider) => (
                    <SpiderCard key={spider.id} spider={spider} isFallenHero={true} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {selectedBattle && (
        <BattleDetailsModal
          isOpen={showBattleModal}
          onClose={() => {
            setShowBattleModal(false);
            setSelectedBattle(null);
          }}
          battle={selectedBattle}
        />
      )}

      <SpiderDetailsModal
        spider={selectedSpider}
        isOpen={showSpiderModal}
        onClose={() => {
          setShowSpiderModal(false);
          setSelectedSpider(null);
        }}
      />
    </div>
  );
};

export default SpiderCollection;