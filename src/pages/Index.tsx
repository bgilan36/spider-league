import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Trophy, Users, Loader2, Lightbulb, Plus, Sword } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { HowItWorksModal } from "@/components/HowItWorksModal";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { supabase } from "@/integrations/supabase/client";
import PowerScoreArc from "@/components/PowerScoreArc";
import SpiderDetailsModal from "@/components/SpiderDetailsModal";
import BattleMode from "@/components/BattleMode";
import BattleButton from "@/components/BattleButton";

interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "UNCOMMON";
  power_score: number;
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  is_approved: boolean;
  owner_id?: string;
  created_at?: string;
}

const Index = () => {
  const { user, signOut, signIn, signUp, signInWithGoogle, signInAsDemo, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [userSpiders, setUserSpiders] = useState<Spider[]>([]);
  const [spidersLoading, setSpidersLoading] = useState(true);
  const [userGlobalRank, setUserGlobalRank] = useState<number | null>(null);
  const [selectedSpider, setSelectedSpider] = useState<Spider | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [topLeaderboardSpiders, setTopLeaderboardSpiders] = useState<Spider[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardType, setLeaderboardType] = useState<'alltime' | 'weekly'>('alltime');
  const [recentBattles, setRecentBattles] = useState<any[]>([]);
  const [battlesLoading, setBattlesLoading] = useState(true);

  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500", 
    RARE: "bg-blue-500",
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500"
  };

  useEffect(() => {
    if (user) {
      fetchUserSpiders();
      fetchUserGlobalRank();
      fetchRecentBattles();
    } else {
      setUserSpiders([]);
      setUserGlobalRank(null);
      setSpidersLoading(false);
      setBattlesLoading(false);
      setRecentBattles([]);
    }
    fetchTopLeaderboardSpiders();
  }, [user, leaderboardType]);

  const fetchUserGlobalRank = async () => {
    if (!user) return;
    
    try {
      // Get user's current ELO rating
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('rating_elo')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (userProfile?.rating_elo) {
        // Get rank by counting users with higher ELO
        const { count, error: rankError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gt('rating_elo', userProfile.rating_elo);

        if (rankError) throw rankError;

        // User's rank is count + 1 (users with higher ELO + themselves)
        setUserGlobalRank((count || 0) + 1);
      }
    } catch (error) {
      console.error('Error fetching user rank:', error);
    }
  };

  const fetchUserSpiders = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, rarity, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved, created_at, owner_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setUserSpiders(data || []);
    } catch (error) {
      console.error('Error fetching spiders:', error);
    } finally {
      setSpidersLoading(false);
    }
  };

  const fetchRecentBattles = async () => {
    if (!user) return;
    
    try {
      setBattlesLoading(true);
      
      // Mock recent battles for now (same as BattleHistory component)
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
              image_url: "/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png"
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
              image_url: "/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png"
            }
          ],
          winner: "TIE",
          battle_log: {}
        }
      ];
      
      setRecentBattles(mockBattles.slice(0, 3)); // Only show 3 most recent
    } catch (error) {
      console.error('Error fetching recent battles:', error);
    } finally {
      setBattlesLoading(false);
    }
  };

  const fetchTopLeaderboardSpiders = async () => {
    try {
      setLeaderboardLoading(true);
      
      if (leaderboardType === 'weekly') {
        // Fetch weekly rankings
        const { data, error } = await supabase
          .from('weekly_rankings')
          .select(`
            power_score,
            rank_position,
            spiders (
              id, nickname, species, image_url, rarity, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved, owner_id, created_at,
              profiles (
                display_name
              )
            )
          `)
          .order('rank_position', { ascending: true })
          .limit(10);

        if (error) throw error;
        
        // Transform the data to match the Spider interface
        const transformedData = (data || []).map(ranking => ({
          ...ranking.spiders,
          profiles: ranking.spiders?.profiles
        })).filter(spider => spider && spider.id) as Spider[];
        
        setTopLeaderboardSpiders(transformedData);
      } else {
        // Fetch all-time rankings (existing logic)
        const { data, error } = await supabase
          .from('spiders')
          .select(`
            id, nickname, species, image_url, rarity, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved, owner_id, created_at,
            profiles (
              display_name
            )
          `)
          .eq('is_approved', true)
          .order('power_score', { ascending: false })
          .limit(10);

        if (error) throw error;
        setTopLeaderboardSpiders(data || []);
      }
    } catch (error) {
      console.error('Error fetching top spiders:', error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleSpiderClick = (spider: Spider) => {
    setSelectedSpider(spider);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        let message = error.message;
        if (error.message.includes("Invalid login credentials")) {
          message = "Invalid email or password";
        } else if (error.message.includes("User already registered")) {
          message = "This email is already registered. Try signing in instead.";
        }
        toast({ title: "Authentication Error", description: message, variant: "destructive" });
      } else {
        if (isSignUp) {
          toast({ title: "Account created!", description: "Please check your email to verify your account." });
        } else {
          toast({ title: "Welcome back!", description: "You've successfully signed in." });
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Helmet>
          <title>Spider League</title>
          <meta name="description" content="Upload spiders, generate stats, and battle in weekly matchups on Spider League." />
          <link rel="canonical" href={`${window.location.origin}/`} />
        </Helmet>
        <div className="w-full max-w-md px-6">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png"
                alt="Spider League Logo" 
                className="h-20 w-auto"
              />
            </div>
            <h1 className="text-3xl font-bold mb-2">Spider League</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isSignUp ? "Create Account" : "Sign In"}</CardTitle>
              <CardDescription>
                {isSignUp 
                  ? "Create an account to start building your spider army" 
                  : "Welcome back! Sign in to your account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    setLoading(true);
                    const { error } = await signInWithGoogle();
                    if (error) {
                      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
                      setLoading(false);
                    }
                    // On success, Supabase will redirect to Google and come back
                  }}
                  disabled={loading}
                >
                  {/* Simple Google "G" svg */}
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 533.5 544.3" aria-hidden="true">
                    <path fill="#EA4335" d="M533.5 278.4c0-18.5-1.7-37-5.3-54.9H272.1v103.9h147.1c-6.2 33.6-25.6 62-54.6 80.9v67h88.4c51.7-47.6 80.5-117.9 80.5-196.9z"/>
                    <path fill="#34A853" d="M272.1 544.3c73.6 0 135.4-24.3 180.6-66.1l-88.4-67c-24.5 16.4-56 26-92.2 26-70.8 0-130.7-47.7-152.2-111.8H28.8v70.2c45 89.4 137.6 148.7 243.3 148.7z"/>
                    <path fill="#4A90E2" d="M119.9 325.4c-10.3-30.9-10.3-64.6 0-95.5V159.7H28.8c-41.9 83.7-41.9 182.4 0 266.1l91.1-70.4z"/>
                    <path fill="#FBBC05" d="M272.1 106.2c39.9-.6 78.2 14 107.5 41.1l80.1-80.1C413.1 24.6 343.7-1.2 272.1 0 166.4 0 73.8 59.3 28.8 148.7l91.1 70.2C141.4 154.8 201.3 106.9 272.1 106.2z"/>
                  </svg>
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={async () => {
                    setLoading(true);
                    const { error } = await signInAsDemo();
                    if (error) {
                      toast({ title: "Demo sign-in failed", description: error.message, variant: "destructive" });
                    } else {
                      toast({ title: "Signed in as Demo User", variant: "default" });
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                >
                  🕷️ Sign in as Demo User (Development)
                </Button>
                <div className="text-center text-xs text-muted-foreground">or continue with email</div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isSignUp ? "Creating Account..." : "Signing In..."}
                    </>
                  ) : (
                    isSignUp ? "Create Account" : "Sign In"
                  )}
                </Button>
              </form>
              
              <div className="mt-4 text-center">
                <Button 
                  variant="link" 
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setEmail("");
                    setPassword("");
                  }}
                >
                  {isSignUp 
                    ? "Already have an account? Sign in" 
                    : "Don't have an account? Sign up"}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <p className="text-center text-sm text-muted-foreground mt-6">
            Battle with spiders you find in the wild.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Dashboard — Spider League</title>
        <meta name="description" content="Manage your spider fighters and compete in Spider League battles." />
        <link rel="canonical" href={`${window.location.origin}/`} />
      </Helmet>
      
      {/* Header */}
      <header className="glass-card border-b border-border/30 sticky top-0 z-40 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="floating">
                <img 
                  src="/lovable-uploads/3a8558c8-28e5-4ad2-8bb8-425536ee81ca.png" 
                  alt="Spider League Logo" 
                  className="h-10 sm:h-14 w-auto flex-shrink-0 drop-shadow-lg"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent truncate">
                  Spider League
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground hidden sm:block font-medium">
                  Welcome back, champion! 🕷️
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Button variant="glass" size="icon" asChild className="h-10 w-10 sm:h-12 sm:w-12">
                <Link to="/roadmap">
                  <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5" />
                </Link>
              </Button>
              <div className="hidden sm:block">
                <HowItWorksModal />
              </div>
              <UserProfileMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* My Spider Squad Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h2 className="text-xl sm:text-2xl font-bold">My Spider Squad</h2>
                {userGlobalRank && (
                  <Badge variant="secondary" className="text-sm w-fit">
                    Global Rank #{userGlobalRank}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link to="/collection" className="flex items-center justify-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="hidden sm:inline">Full Collection</span>
                  <span className="sm:hidden">Collection</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link to="/battle-history" className="flex items-center justify-center gap-2">
                  <Sword className="h-4 w-4" />
                  <span className="hidden sm:inline">Battle History</span>
                  <span className="sm:hidden">History</span>
                </Link>
              </Button>
              <Button asChild className="gradient-button relative z-10 w-full sm:w-auto" size="sm">
                <Link to="/upload" className="flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload Spider</span>
                  <span className="sm:hidden">Upload</span>
                </Link>
              </Button>
            </div>
          </div>

          {spidersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : userSpiders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No spiders yet</h3>
                <p className="text-muted-foreground mb-6">Upload your first spider to start building your collection</p>
                <Button asChild className="gradient-button relative z-10 pulse-glow">
                  <Link to="/upload" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Upload Your First Spider
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userSpiders.map((spider) => (
                <div 
                  key={spider.id} 
                  className="spider-card-mini cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => handleSpiderClick(spider)}
                >
                  <div className="aspect-square relative mb-3 rounded-md overflow-hidden">
                    <img 
                      src={spider.image_url} 
                      alt={spider.nickname}
                      className="w-full h-full object-cover"
                    />
                    <Badge 
                      className={`absolute top-1 right-1 text-xs ${rarityColors[spider.rarity]} text-white`}
                    >
                      {spider.rarity}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <h4 className="font-medium text-sm mb-1 truncate">{spider.nickname}</h4>
                    <p className="text-xs text-muted-foreground mb-2 truncate">{spider.species}</p>
                    <div className="flex justify-center">
                      <PowerScoreArc score={spider.power_score} size="small" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Battle Mode Section */}
        <div className="mb-8">
          <BattleMode />
        </div>

        {/* Recent Battles Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2">Recent Battles</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Your latest combat encounters
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to="/battle-history" className="flex items-center justify-center gap-2">
                <Sword className="h-4 w-4" />
                <span className="hidden sm:inline">View All Battles</span>
                <span className="sm:hidden">View All</span>
              </Link>
            </Button>
          </div>

          {battlesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : recentBattles.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Sword className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No battles yet</h3>
                <p className="text-muted-foreground">Start challenging other players to see your battle history!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentBattles.map((battle) => {
                const teamA = Array.isArray(battle.team_a) ? battle.team_a : [];
                const teamB = Array.isArray(battle.team_b) ? battle.team_b : [];
                const isUserTeamA = teamA?.[0]?.owner_id === user.id;
                const userSpider = isUserTeamA ? teamA[0] : teamB[0];
                const opponentSpider = isUserTeamA ? teamB[0] : teamA[0];
                
                let resultBadge;
                let resultText;
                if (!battle.winner) {
                  resultBadge = <Badge variant="secondary">In Progress</Badge>;
                  resultText = "In Progress";
                } else if (battle.winner === "TIE") {
                  resultBadge = <Badge variant="outline">Tie</Badge>;
                  resultText = "Tied";
                } else {
                  const userWon = (battle.winner === "A" && isUserTeamA) || 
                                  (battle.winner === "B" && !isUserTeamA);
                  resultBadge = userWon ? 
                    <Badge className="bg-green-500 text-white">Victory</Badge> : 
                    <Badge variant="destructive">Defeat</Badge>;
                  resultText = userWon ? "Won" : "Lost";
                }
                
                return (
                  <Card key={battle.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        {/* User Spider */}
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md overflow-hidden flex-shrink-0">
                          <img 
                            src={userSpider?.image_url} 
                            alt={userSpider?.nickname}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{userSpider?.nickname}</p>
                          <p className="text-xs text-muted-foreground truncate">{userSpider?.species}</p>
                        </div>
                        
                        {/* VS */}
                        <div className="flex-shrink-0 mx-2">
                          <span className="text-xs font-bold text-muted-foreground">VS</span>
                        </div>
                        
                        {/* Opponent Spider */}
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md overflow-hidden flex-shrink-0">
                          <img 
                            src={opponentSpider?.image_url} 
                            alt={opponentSpider?.nickname}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{opponentSpider?.nickname}</p>
                          <p className="text-xs text-muted-foreground truncate">{opponentSpider?.species}</p>
                        </div>
                      </div>
                      
                      {/* Result and Date */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {resultBadge}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(battle.created_at), 'MMM d')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Leaderboard Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                <h2 className="text-xl sm:text-2xl font-bold">Global Leaderboard</h2>
                <div className="flex bg-muted rounded-lg p-1 w-fit">
                  <button
                    onClick={() => setLeaderboardType('alltime')}
                    className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                      leaderboardType === 'alltime' 
                        ? 'bg-background text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All-Time
                  </button>
                  <button
                    onClick={() => setLeaderboardType('weekly')}
                    className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                      leaderboardType === 'weekly' 
                        ? 'bg-background text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Weekly
                  </button>
                </div>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                {leaderboardType === 'alltime' 
                  ? 'Top 10 most powerful spider fighters of all time'
                  : 'Top 10 spider fighters for this week'
                }
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to="/leaderboard" className="flex items-center justify-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">View Full Leaderboard</span>
                <span className="sm:hidden">Leaderboard</span>
              </Link>
            </Button>
          </div>

          {leaderboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : topLeaderboardSpiders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No spiders yet</h3>
                <p className="text-muted-foreground">Be the first to upload a spider and claim the top spot!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {topLeaderboardSpiders.map((spider, index) => {
                const rank = index + 1;
                const ownerName = (spider as any).profiles?.display_name || `User ${spider.owner_id?.slice(0, 8)}`;
                return (
                   <Card key={spider.id} className={`hover:shadow-md transition-shadow ${rank <= 3 ? 'ring-1 ring-primary/20' : ''}`}>
                    <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4">
                      <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
                        <div className="w-6 sm:w-8 text-center">
                          {rank === 1 && <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 mx-auto" />}
                          {rank === 2 && <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mx-auto" />}
                          {rank === 3 && <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 mx-auto" />}
                          {rank > 3 && <span className="font-bold text-sm sm:text-lg">#{rank}</span>}
                        </div>
                        <Badge variant={rank <= 3 ? "default" : "secondary"} className="font-bold text-xs sm:text-sm hidden sm:inline-flex">
                          {rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`}
                        </Badge>
                      </div>
                      
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden flex-shrink-0">
                        <img 
                          src={spider.image_url} 
                          alt={spider.nickname}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 sm:gap-2 mb-1">
                            <h4 className="font-semibold text-sm sm:text-base truncate">{spider.nickname}</h4>
                            <Badge 
                              className={`text-xs ${rarityColors[spider.rarity]} text-white hidden sm:inline-flex`}
                            >
                              {spider.rarity}
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{spider.species}</p>
                          <p className="text-xs text-muted-foreground truncate hidden sm:block">Owner: {ownerName}</p>
                          {spider.created_at && (
                            <p className="text-xs text-muted-foreground">
                              Uploaded: {format(new Date(spider.created_at), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                        
                        <BattleButton 
                          targetSpider={spider} 
                          size="sm" 
                          variant="outline"
                          context="leaderboard"
                        />
                        
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-lg sm:text-xl font-bold">{spider.power_score}</div>
                          <div className="text-xs text-muted-foreground">Power</div>
                        </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </main>
      
      <SpiderDetailsModal 
        spider={selectedSpider}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default Index;
