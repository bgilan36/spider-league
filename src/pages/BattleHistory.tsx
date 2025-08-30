import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Trophy, Swords, Clock, Target, Crown, TrendingUp, Calendar, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { format } from "date-fns";

interface Battle {
  id: string;
  created_at: string;
  type: string;
  team_a: any;
  team_b: any;
  winner: "A" | "B" | "TIE" | null;
  battle_log: any;
}

interface BattleChallenge {
  id: string;
  challenger_id: string;
  accepter_id: string | null;
  challenger_spider_id: string;
  accepter_spider_id: string | null;
  battle_id: string | null;
  winner_id: string | null;
  loser_spider_id: string | null;
  status: string;
  challenge_message: string;
  created_at: string;
  expires_at: string;
  challenger_spider?: {
    nickname: string;
    image_url: string;
    species: string;
  } | null;
  accepter_spider?: {
    nickname: string;
    image_url: string;
    species: string;
  } | null;
  challenger_profile?: {
    display_name: string;
  } | null;
  accepter_profile?: {
    display_name: string;
  } | null;
}

interface BattleStats {
  totalBattles: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  challengesSent: number;
  challengesReceived: number;
  spidersLost: number;
  spidersWon: number;
}

const BattleHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [challenges, setChallenges] = useState<BattleChallenge[]>([]);
  const [stats, setStats] = useState<BattleStats>({
    totalBattles: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    winRate: 0,
    challengesSent: 0,
    challengesReceived: 0,
    spidersLost: 0,
    spidersWon: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"battles" | "challenges" | "stats">("battles");

  useEffect(() => {
    if (user) {
      fetchBattleData();
    }
  }, [user]);

  const fetchBattleData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch user's battles
      const { data: battleData, error: battleError } = await supabase
        .from('battles')
        .select('*')
        .or(`team_a->0->owner_id.eq.${user.id},team_b->0->owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (battleError) throw battleError;

      // Fetch user's challenges
      const { data: challengeData, error: challengeError } = await supabase
        .from('battle_challenges')
        .select(`
          *,
          challenger_spider:spiders!challenger_spider_id(nickname, image_url, species),
          accepter_spider:spiders!accepter_spider_id(nickname, image_url, species),
          challenger_profile:profiles!challenger_id(display_name),
          accepter_profile:profiles!accepter_id(display_name)
        `)
        .or(`challenger_id.eq.${user.id},accepter_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (challengeError) throw challengeError;

      setBattles((battleData || []) as any);
      setChallenges((challengeData || []) as any);
      
      // Calculate stats
      calculateStats(battleData || [], challengeData || []);

    } catch (error: any) {
      console.error("Error fetching battle data:", error);
      toast({
        title: "Error",
        description: "Failed to load battle history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (battleData: any[], challengeData: any[]) => {
    if (!user) return;

    let wins = 0;
    let losses = 0;
    let ties = 0;
    let spidersWon = 0;
    let spidersLost = 0;

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

    // Count spider transfers from challenges
    challengeData.forEach(challenge => {
      if (challenge.status === 'COMPLETED' && challenge.winner_id && challenge.loser_spider_id) {
        if (challenge.winner_id === user.id) {
          spidersWon++;
        } else {
          spidersLost++;
        }
      }
    });

    const totalBattles = wins + losses + ties;
    const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;
    
    const challengesSent = challengeData.filter(c => c.challenger_id === user.id).length;
    const challengesReceived = challengeData.filter(c => c.accepter_id === user.id).length;

    setStats({
      totalBattles,
      wins,
      losses,
      ties,
      winRate,
      challengesSent,
      challengesReceived,
      spidersWon,
      spidersLost,
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

  const getStatusBadge = (challenge: BattleChallenge) => {
    switch (challenge.status) {
      case 'OPEN':
        return <Badge variant="outline">Open</Badge>;
      case 'ACCEPTED':
        return <Badge className="bg-blue-500 text-white">Accepted</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case 'EXPIRED':
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="secondary">{challenge.status}</Badge>;
    }
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
    <div className="min-h-screen bg-background">
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
                src="/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png" 
                alt="Spider League Logo" 
                className="h-16 w-auto"
              />
            </div>
            <h1 className="text-4xl font-bold mb-2">Battle History</h1>
            <p className="text-muted-foreground">Your complete combat record and statistics</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="battles" className="flex items-center gap-2">
              <Swords className="h-4 w-4" />
              Battles
            </TabsTrigger>
            <TabsTrigger value="challenges" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Statistics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="battles">
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
                    <Card key={battle.id} className="hover:shadow-md transition-shadow">
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
          </TabsContent>

          <TabsContent value="challenges">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Challenge History
                </CardTitle>
                <CardDescription>
                  Track all challenges sent and received
                </CardDescription>
              </CardHeader>
            </Card>

            {challenges.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No challenges yet</h3>
                  <p className="text-muted-foreground">Your challenge history will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {challenges.map((challenge) => {
                  const isSentByUser = challenge.challenger_id === user?.id;
                  
                  return (
                    <Card key={challenge.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="flex items-center gap-4 p-6">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground mb-1">
                              {isSentByUser ? 'Your Spider' : 'Challenger'}
                            </div>
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted mx-auto mb-2">
                              {challenge.challenger_spider?.image_url && (
                                <img 
                                  src={challenge.challenger_spider.image_url} 
                                  alt={challenge.challenger_spider.nickname}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="font-medium text-sm">
                              {challenge.challenger_spider?.nickname || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {challenge.challenger_profile?.display_name || 'Unknown User'}
                            </div>
                          </div>
                          
                          <div className="text-center flex-shrink-0">
                            <div className="text-xl font-bold mb-2">
                              {isSentByUser ? 'CHALLENGED' : 'CHALLENGED BY'}
                            </div>
                            {getStatusBadge(challenge)}
                          </div>
                          
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground mb-1">
                              {isSentByUser ? 'Target' : 'Your Spider'}
                            </div>
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted mx-auto mb-2">
                              {challenge.accepter_spider?.image_url ? (
                                <img 
                                  src={challenge.accepter_spider.image_url} 
                                  alt={challenge.accepter_spider.nickname}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center text-xs">
                                  Pending
                                </div>
                              )}
                            </div>
                            <div className="font-medium text-sm">
                              {challenge.accepter_spider?.nickname || 'Pending'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {challenge.accepter_profile?.display_name || 'Unknown User'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(challenge.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            Expires: {format(new Date(challenge.expires_at), 'MMM d')}
                          </div>
                          {challenge.winner_id && (
                            <div className="text-xs">
                              Winner: {challenge.winner_id === user?.id ? 'You' : 'Opponent'}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Challenges</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.challengesSent + stats.challengesReceived}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.challengesSent} sent / {stats.challengesReceived} received
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Spider Trades</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.spidersWon + stats.spidersLost}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.spidersWon} won / {stats.spidersLost} lost
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default BattleHistory;