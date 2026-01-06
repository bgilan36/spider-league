import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Trophy, Swords, Crown, Calendar, Bug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { format } from "date-fns";
import BattleDetailsModal from "@/components/BattleDetailsModal";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useIsMobile } from "@/hooks/use-mobile";

interface Battle {
  id: string;
  created_at: string;
  type: string;
  team_a: any;
  team_b: any;
  winner: "A" | "B" | "TIE" | null;
  battle_log: any;
  challenge_id?: string;
}

interface BattleStats {
  totalBattles: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
}

interface SpiderBattleRecord {
  spiderId: string;
  nickname: string;
  species: string;
  image_url: string;
  wins: number;
  losses: number;
  ties: number;
  totalBattles: number;
  winRate: number;
}

const BattleHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [stats, setStats] = useState<BattleStats>({
    totalBattles: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    winRate: 0,
  });
  const [spiderRecords, setSpiderRecords] = useState<SpiderBattleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBattle, setSelectedBattle] = useState<Battle | null>(null);
  const [isBattleDetailsOpen, setIsBattleDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("battles");

  const isMobile = useIsMobile();

  const handleRefresh = useCallback(async () => {
    await fetchBattleData();
    toast({ title: "Refreshed", description: "Battle history updated" });
  }, [user]);

  const {
    pullDistance,
    isRefreshing,
    progress,
    shouldTrigger,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: !isMobile,
  });

  useEffect(() => {
    if (user) {
      fetchBattleData();
    }
  }, [user]);

  useEffect(() => {
    const battleId = searchParams.get('battleId');
    if (battleId && battles.length > 0) {
      const battle = battles.find(b => b.id === battleId);
      if (battle) {
        setSelectedBattle(battle);
        setIsBattleDetailsOpen(true);
        // Clear the query param after opening
        setSearchParams({});
      }
    }
  }, [searchParams, battles]);

  const fetchBattleData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch real battles from Supabase where user was a participant
      const { data: battlesData, error } = await supabase
        .from('battles')
        .select('*')
        .eq('is_active', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Filter battles where the user was a participant
      const userBattles = (battlesData || []).filter(battle => {
        const teamA = battle.team_a as any;
        const teamB = battle.team_b as any;
        return teamA?.userId === user.id || teamB?.userId === user.id;
      });

      setBattles(userBattles as Battle[]);
      
      // Calculate stats and spider records
      calculateStats(userBattles);
      calculateSpiderRecords(userBattles);

    } catch (error: any) {
      console.error("Error loading battle data:", error);
      toast({
        title: "Error",
        description: "Failed to load battle history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (battleData: any[]) => {
    if (!user) return;

    let wins = 0;
    let losses = 0;
    let ties = 0;

    battleData.forEach(battle => {
      const teamA = battle.team_a as any;
      const teamB = battle.team_b as any;
      const isTeamA = teamA?.userId === user.id;
      
      if (battle.winner === "TIE") {
        ties++;
      } else if (
        (battle.winner === "A" && isTeamA) ||
        (battle.winner === "B" && !isTeamA)
      ) {
        wins++;
      } else if (battle.winner) {
        losses++;
      }
    });

    const totalBattles = wins + losses + ties;
    const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;

    setStats({
      totalBattles,
      wins,
      losses,
      ties,
      winRate,
    });
  };

  const calculateSpiderRecords = (battleData: any[]) => {
    if (!user) return;

    const spiderMap = new Map<string, SpiderBattleRecord>();

    battleData.forEach(battle => {
      const teamA = battle.team_a as any;
      const teamB = battle.team_b as any;
      const isTeamA = teamA?.userId === user.id;
      
      const userTeam = isTeamA ? teamA : teamB;
      const spiderId = userTeam?.spiderId;
      
      if (!spiderId) return;

      if (!spiderMap.has(spiderId)) {
        spiderMap.set(spiderId, {
          spiderId,
          nickname: userTeam?.nickname || 'Unknown',
          species: userTeam?.species || 'Unknown',
          image_url: userTeam?.imageUrl || '',
          wins: 0,
          losses: 0,
          ties: 0,
          totalBattles: 0,
          winRate: 0,
        });
      }

      const record = spiderMap.get(spiderId)!;
      record.totalBattles++;

      if (battle.winner === "TIE") {
        record.ties++;
      } else if (
        (battle.winner === "A" && isTeamA) ||
        (battle.winner === "B" && !isTeamA)
      ) {
        record.wins++;
      } else if (battle.winner) {
        record.losses++;
      }

      record.winRate = record.totalBattles > 0 
        ? Math.round((record.wins / record.totalBattles) * 100) 
        : 0;
    });

    // Sort by total battles descending
    const records = Array.from(spiderMap.values()).sort((a, b) => b.totalBattles - a.totalBattles);
    setSpiderRecords(records);
  };

  const getResultBadge = (battle: Battle, isUserTeamA: boolean) => {
    if (!battle.winner) {
      return <Badge variant="secondary">In Progress</Badge>;
    }
    
    if (battle.winner === "TIE") {
      return <Badge variant="outline">Tie</Badge>;
    }
    
    const userWon = (battle.winner === "A" && isUserTeamA) || 
                    (battle.winner === "B" && !isUserTeamA);
    
    return userWon ? 
      <Badge className="bg-green-500 text-white">Victory</Badge> : 
      <Badge variant="destructive">Defeat</Badge>;
  };

  const handleBattleClick = (battle: Battle) => {
    setSelectedBattle(battle);
    setIsBattleDetailsOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading battle history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
        shouldTrigger={shouldTrigger}
      />
      <Helmet>
        <title>Battle History — Spider League</title>
        <meta name="description" content="View your battle history, statistics, and challenge records in Spider League." />
        <link rel="canonical" href={`${window.location.origin}/battle-history`} />
      </Helmet>
      
      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Battle History</span>
        </div>
        
        <div className="flex items-center justify-center mb-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                alt="Spider League Logo" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-4xl font-bold mb-2">Battle History</h1>
            <p className="text-muted-foreground">Your complete combat record and statistics</p>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Battles</CardTitle>
              <Swords className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBattles}</div>
              <p className="text-xs text-muted-foreground">
                All battles fought
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.winRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.wins}W / {stats.losses}L / {stats.ties}T
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Combat Summary
            </CardTitle>
            <CardDescription>
              Your overall performance in Spider League
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Battle Experience</span>
                <span className="text-sm text-muted-foreground">
                  {stats.totalBattles === 0 ? 'Rookie' : 
                   stats.totalBattles < 5 ? 'Novice' : 
                   stats.totalBattles < 15 ? 'Experienced' : 
                   stats.totalBattles < 30 ? 'Veteran' : 'Champion'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Combat Rating</span>
                <span className="text-sm text-muted-foreground">
                  {stats.winRate >= 80 ? 'Elite' : 
                   stats.winRate >= 60 ? 'Skilled' : 
                   stats.winRate >= 40 ? 'Average' : 
                   stats.winRate >= 20 ? 'Developing' : 'Learning'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Most Active Period</span>
                <span className="text-sm text-muted-foreground">
                  {battles.length > 0 ? 'This week' : 'Not active yet'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="battles" className="gap-2">
              <Swords className="h-4 w-4" />
              Battle Results
            </TabsTrigger>
            <TabsTrigger value="spiders" className="gap-2">
              <Bug className="h-4 w-4" />
              Spider Records
            </TabsTrigger>
          </TabsList>

          <TabsContent value="battles" className="mt-6">
            {battles.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Swords className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No battles yet</h3>
                  <p className="text-muted-foreground">Your battle results will appear here once you start fighting</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {battles.map((battle) => {
                  const teamA = battle.team_a as any;
                  const teamB = battle.team_b as any;
                  const isUserTeamA = teamA?.userId === user?.id;
                  const userTeam = isUserTeamA ? teamA : teamB;
                  const opponentTeam = isUserTeamA ? teamB : teamA;
                  
                  return (
                    <Card key={battle.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleBattleClick(battle)}>
                      <CardContent className="flex items-center gap-4 p-6">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground mb-1">Your Spider</div>
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted mx-auto mb-2">
                              {userTeam?.imageUrl && (
                                <img 
                                  src={userTeam.imageUrl} 
                                  alt={userTeam.nickname}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="font-medium text-sm">{userTeam?.nickname || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{userTeam?.species}</div>
                          </div>
                          
                          <div className="text-center flex-shrink-0">
                            <div className="text-2xl font-bold mb-2">VS</div>
                            {getResultBadge(battle, isUserTeamA)}
                          </div>
                          
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground mb-1">Opponent</div>
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted mx-auto mb-2">
                              {opponentTeam?.imageUrl && (
                                <img 
                                  src={opponentTeam.imageUrl} 
                                  alt={opponentTeam.nickname}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="font-medium text-sm">{opponentTeam?.nickname || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{opponentTeam?.species}</div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(battle.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(battle.created_at), 'h:mm a')}
                          </div>
                          <Badge variant="outline" className="mt-2">
                            {battle.type}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="spiders" className="mt-6">
            {spiderRecords.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Bug className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No spider records yet</h3>
                  <p className="text-muted-foreground">Your spiders' battle records will appear here once they start fighting</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {spiderRecords.map((record) => (
                  <Card key={record.spiderId} className="overflow-hidden">
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {record.image_url && (
                          <img 
                            src={record.image_url} 
                            alt={record.nickname}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{record.nickname}</h4>
                        <p className="text-xs text-muted-foreground truncate">{record.species}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {record.totalBattles} battles
                          </Badge>
                          <Badge 
                            className={`text-xs ${
                              record.winRate >= 60 ? 'bg-green-500' : 
                              record.winRate >= 40 ? 'bg-amber-500' : 
                              'bg-red-500'
                            } text-white`}
                          >
                            {record.winRate}% WR
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/30 px-4 py-3 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-500 font-medium">{record.wins}W</span>
                        <span className="text-red-500 font-medium">{record.losses}L</span>
                        <span className="text-muted-foreground font-medium">{record.ties}T</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <BattleDetailsModal 
          isOpen={isBattleDetailsOpen}
          onClose={() => setIsBattleDetailsOpen(false)}
          battle={selectedBattle}
        />
      </main>
    </div>
  );
};

export default BattleHistory;