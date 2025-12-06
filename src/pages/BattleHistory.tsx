import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Trophy, Swords, Crown, Calendar } from "lucide-react";
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
}


interface BattleStats {
  totalBattles: number;
  wins: number;
  losses: number;
  ties: number;
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
  const [loading, setLoading] = useState(true);
  const [selectedBattle, setSelectedBattle] = useState<Battle | null>(null);
  const [isBattleDetailsOpen, setIsBattleDetailsOpen] = useState(false);

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

      // Mock battle data
      const mockBattles = [
        {
          id: "battle-1",
          created_at: "2024-01-15T14:30:00Z",
          type: "CHALLENGE",
          team_a: [
            {
              owner_id: user.id,
              nickname: "Shadowstrike",
              species: "Black Widow",
              image_url: "/lovable-uploads/218cca6b-fdab-43a0-9a30-c4defe401691.png"
            }
          ],
          team_b: [
            {
              owner_id: "other-user-1",
              nickname: "Venomfang",
              species: "Brown Recluse",
              image_url: "/lovable-uploads/72396214-19a6-4e47-b07c-6dd315d94727.png"
            }
          ],
          winner: "A",
          battle_log: {}
        },
        {
          id: "battle-2",
          created_at: "2024-01-12T09:15:00Z",
          type: "CHALLENGE",
          team_a: [
            {
              owner_id: "other-user-2",
              nickname: "Webweaver",
              species: "Orb Weaver",
              image_url: "/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png"
            }
          ],
          team_b: [
            {
              owner_id: user.id,
              nickname: "Nightcrawler",
              species: "Wolf Spider",
              image_url: "/lovable-uploads/218cca6b-fdab-43a0-9a30-c4defe401691.png"
            }
          ],
          winner: "B",
          battle_log: {}
        },
        {
          id: "battle-3",
          created_at: "2024-01-10T16:45:00Z",
          type: "SANDBOX",
          team_a: [
            {
              owner_id: user.id,
              nickname: "Frostbite",
              species: "Jumping Spider",
              image_url: "/lovable-uploads/72396214-19a6-4e47-b07c-6dd315d94727.png"
            }
          ],
          team_b: [
            {
              owner_id: "other-user-3",
              nickname: "Steelclaw",
              species: "Tarantula",
              image_url: "/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png"
            }
          ],
          winner: "TIE",
          battle_log: {}
        },
        {
          id: "battle-4",
          created_at: "2024-01-08T11:20:00Z",
          type: "CHALLENGE",
          team_a: [
            {
              owner_id: user.id,
              nickname: "Thunderstrike",
              species: "Black Widow",
              image_url: "/lovable-uploads/218cca6b-fdab-43a0-9a30-c4defe401691.png"
            }
          ],
          team_b: [
            {
              owner_id: "other-user-4",
              nickname: "Poisonheart",
              species: "Brown Recluse",
              image_url: "/lovable-uploads/72396214-19a6-4e47-b07c-6dd315d94727.png"
            }
          ],
          winner: "B",
          battle_log: {}
        }
      ];

      setBattles(mockBattles as any);
      
      // Calculate stats
      calculateStats(mockBattles);

    } catch (error: any) {
      console.error("Error loading mock battle data:", error);
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

    // Count battle outcomes
    battleData.forEach(battle => {
      const teamA = Array.isArray(battle.team_a) ? battle.team_a : [];
      const teamB = Array.isArray(battle.team_b) ? battle.team_b : [];
      const isTeamA = teamA?.[0]?.owner_id === user.id;
      
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

        {/* Battle Results Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              Battle Results
            </CardTitle>
            <CardDescription>
              Complete history of your spider battles
            </CardDescription>
          </CardHeader>
        </Card>

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
              const teamA = Array.isArray(battle.team_a) ? battle.team_a : [];
              const teamB = Array.isArray(battle.team_b) ? battle.team_b : [];
              const isUserTeamA = teamA?.[0]?.owner_id === user?.id;
              const userSpider = isUserTeamA ? teamA?.[0] : teamB?.[0];
              const opponentSpider = isUserTeamA ? teamB?.[0] : teamA?.[0];
              
              return (
                <Card key={battle.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleBattleClick(battle)}>
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-1">Your Spider</div>
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted mx-auto mb-2">
                          {userSpider?.image_url && (
                            <img 
                              src={userSpider.image_url} 
                              alt={userSpider.nickname}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="font-medium text-sm">{userSpider?.nickname || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{userSpider?.species}</div>
                      </div>
                      
                      <div className="text-center flex-shrink-0">
                        <div className="text-2xl font-bold mb-2">VS</div>
                        {getResultBadge(battle, isUserTeamA)}
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-1">Opponent</div>
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted mx-auto mb-2">
                          {opponentSpider?.image_url && (
                            <img 
                              src={opponentSpider.image_url} 
                              alt={opponentSpider.nickname}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="font-medium text-sm">{opponentSpider?.nickname || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{opponentSpider?.species}</div>
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