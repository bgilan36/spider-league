import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Trophy, Users, Loader2, Lightbulb, Plus, Sword, Bug } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { HowItWorksModal } from "@/components/HowItWorksModal";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { BadgeNotification } from "@/components/BadgeNotification";
import { useBadgeSystem } from "@/hooks/useBadgeSystem";
import { UserProfileModal } from "@/components/UserProfileModal";
import { supabase } from "@/integrations/supabase/client";
import PowerScoreArc from "@/components/PowerScoreArc";
import SpiderDetailsModal from "@/components/SpiderDetailsModal";
import BattleMode from "@/components/BattleMode";
import BattleButton from "@/components/BattleButton";
import ActiveChallengesPreview from "@/components/ActiveChallengesPreview";
import BattleDetailsModal from "@/components/BattleDetailsModal";
import { BattleRecapAlert } from "@/components/BattleRecapAlert";
import ClickableUsername from "@/components/ClickableUsername";
import { InstallPrompt } from "@/components/InstallPrompt";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import OnlineUsersBar from "@/components/OnlineUsersBar";
import NewSpiderSpotlight from "@/components/NewSpiderSpotlight";
import { BattleRecapBanner } from "@/components/BattleRecapBanner";

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
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const { newBadge, showBadgeNotification, checkAndAwardBadges, dismissBadgeNotification } = useBadgeSystem();
  const [userSpiders, setUserSpiders] = useState<Spider[]>([]);
  const [spidersLoading, setSpidersLoading] = useState(true);
  const [userGlobalRank, setUserGlobalRank] = useState<number | null>(null);
  const [selectedSpider, setSelectedSpider] = useState<Spider | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [topLeaderboardSpiders, setTopLeaderboardSpiders] = useState<Spider[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardType, setLeaderboardType] = useState<'alltime' | 'weekly'>('alltime');
  const [leaderboardView, setLeaderboardView] = useState<'spiders' | 'users'>('spiders');
  const [recentBattles, setRecentBattles] = useState<any[]>([]);
  const [battlesLoading, setBattlesLoading] = useState(true);
  const [selectedBattle, setSelectedBattle] = useState<any>(null);
  const [isBattleDetailsOpen, setIsBattleDetailsOpen] = useState(false);
  const [weeklyUploadCount, setWeeklyUploadCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    fetchTopUsers();
  }, [user, leaderboardType]);

  // Set up real-time subscription for battles
  useEffect(() => {
    const channel = supabase
      .channel('battles-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'battles'
      }, () => {
        // Refresh recent battles when a new battle is created
        fetchRecentBattles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    setSpidersLoading(true);
    
    try {
      // Get the current week's eligible spiders (up to 3 spiders uploaded this week)
      // Convert current time to PT (Pacific Time)
      const ptNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const dayOfWeek = ptNow.getDay(); // 0 = Sunday
      
      // Calculate Sunday of current week in PT (week starts on Sunday)
      const weekStart = new Date(ptNow);
      weekStart.setDate(ptNow.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      
      // Query spiders uploaded this week directly
      const weekStartISO = weekStart.toISOString();
      const { data: spidersThisWeek, error: spidersError } = await supabase
        .from('spiders')
        .select('id, nickname, species, image_url, rarity, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved, created_at, owner_id')
        .eq('owner_id', user.id)
        .eq('is_approved', true)
        .gte('created_at', weekStartISO)
        .order('created_at', { ascending: true });

      if (spidersError) throw spidersError;

      // Get spiders with active challenges (regardless of upload date)
      const { data: activeChallenges, error: challengesError } = await supabase
        .from('battle_challenges')
        .select('challenger_spider_id, accepter_spider_id')
        .or(`challenger_id.eq.${user.id},accepter_id.eq.${user.id}`)
        .eq('status', 'OPEN')
        .gt('expires_at', new Date().toISOString());

      if (challengesError) throw challengesError;

      // Get unique spider IDs from challenges
      const challengeSpiderIds = new Set<string>();
      activeChallenges?.forEach(challenge => {
        if (challenge.challenger_spider_id) challengeSpiderIds.add(challenge.challenger_spider_id);
        if (challenge.accepter_spider_id) challengeSpiderIds.add(challenge.accepter_spider_id);
      });

      // Fetch spiders with active challenges that aren't already in spidersThisWeek
      let challengeSpiders: Spider[] = [];
      if (challengeSpiderIds.size > 0) {
        const { data: spidersWithChallenges, error: spidersWithChallengesError } = await supabase
          .from('spiders')
          .select('id, nickname, species, image_url, rarity, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved, created_at, owner_id')
          .in('id', Array.from(challengeSpiderIds))
          .eq('owner_id', user.id)
          .eq('is_approved', true);

        if (!spidersWithChallengesError && spidersWithChallenges) {
          challengeSpiders = spidersWithChallenges;
        }
      }

      // Combine spiders uploaded this week with spiders that have active challenges
      const spiderMap = new Map<string, Spider>();
      
      // Add spiders from this week (up to 3)
      spidersThisWeek?.slice(0, 3).forEach(spider => {
        spiderMap.set(spider.id, spider);
      });

      // Add challenge spiders (these are also eligible)
      challengeSpiders.forEach(spider => {
        spiderMap.set(spider.id, spider);
      });

      // Set the weekly upload count based on actual spiders uploaded this week
      const uploadCount = spidersThisWeek?.length || 0;
      setWeeklyUploadCount(uploadCount);

      // Use all eligible spiders
      setUserSpiders(Array.from(spiderMap.values()));
    } catch (error) {
      console.error('Error fetching spiders:', error);
      setUserSpiders([]);
    } finally {
      setSpidersLoading(false);
    }
  };

  const fetchRecentBattles = async () => {
    try {
      setBattlesLoading(true);
      
      // Fetch recent completed battles from all players
      const { data: battles, error } = await supabase
        .from('battles')
        .select('*')
        .eq('is_active', false)
        .not('winner', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      // Parse team_a and team_b which are JSONB objects with structure:
      // { userId: string, spider: { ...spider object } }
      const battlesWithSpiders = (battles || []).map((battle) => {
        const teamA = battle.team_a as any;
        const teamB = battle.team_b as any;
        
        return {
          ...battle,
          team_a: teamA?.spider ? [teamA.spider] : [],
          team_b: teamB?.spider ? [teamB.spider] : []
        };
      });

      setRecentBattles(battlesWithSpiders);
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
          .limit(5);

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
          .limit(5);

        if (error) throw error;
        setTopLeaderboardSpiders(data || []);
      }
    } catch (error) {
      console.error('Error fetching top spiders:', error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const fetchTopUsers = async () => {
    try {
      setLeaderboardLoading(true);

      // Get user rankings with cumulative power scores
      const { data: userRankings, error } = await supabase
        .from('spiders')
        .select(`
          owner_id,
          power_score,
          id,
          nickname,
          species,
          image_url,
          rarity,
          profiles!owner_id (
            display_name,
            avatar_url
          )
        `)
        .eq('is_approved', true);

      if (error) throw error;

      // Process the data to calculate user cumulative scores
      const userMap = new Map();
      
      userRankings?.forEach((spider: any) => {
        const userId = spider.owner_id;
        const existing = userMap.get(userId);
        
        if (existing) {
          existing.total_power_score += spider.power_score;
          existing.spider_count += 1;
          // Update top spider if this one has higher power score
          if (!existing.top_spider || spider.power_score > existing.top_spider.power_score) {
            existing.top_spider = {
              id: spider.id,
              nickname: spider.nickname,
              species: spider.species,
              image_url: spider.image_url,
              power_score: spider.power_score,
              rarity: spider.rarity
            };
          }
        } else {
          userMap.set(userId, {
            user_id: userId,
            display_name: spider.profiles?.display_name || null,
            avatar_url: spider.profiles?.avatar_url || null,
            total_power_score: spider.power_score,
            spider_count: 1,
            top_spider: {
              id: spider.id,
              nickname: spider.nickname,
              species: spider.species,
              image_url: spider.image_url,
              power_score: spider.power_score,
              rarity: spider.rarity
            }
          });
        }
      });

      // Convert to array and sort by total power score
      const sortedUsers = Array.from(userMap.values())
        .sort((a: any, b: any) => b.total_power_score - a.total_power_score)
        .slice(0, 5);

      setTopUsers(sortedUsers);
    } catch (error) {
      console.error('Error fetching top users:', error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleSpiderClick = (spider: Spider) => {
    setSelectedSpider(spider);
    setIsModalOpen(true);
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setIsUserModalOpen(true);
  };

  const handleUserModalClose = () => {
    setIsUserModalOpen(false);
    setSelectedUserId(null);
  };

  const handleBattleClick = (battle: any) => {
    setSelectedBattle(battle);
    setIsBattleDetailsOpen(true);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Store file in sessionStorage as base64 for navigation
      const reader = new FileReader();
      reader.onload = () => {
        sessionStorage.setItem('pendingUploadFile', JSON.stringify({
          data: reader.result,
          name: file.name,
          type: file.type
        }));
        navigate('/upload');
      };
      reader.readAsDataURL(file);
    }
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
        // Set remember me preference on successful sign in
        if (!isSignUp) {
          if (rememberMe) {
            // Store timestamp for 30-day expiration check
            localStorage.setItem('rememberMe', Date.now().toString());
          } else {
            sessionStorage.setItem('tempSession', 'true');
            localStorage.removeItem('rememberMe');
          }
        }
        
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
                src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png"
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
                    // Store remember preference with timestamp (default to true for Google auth)
                    localStorage.setItem('rememberMe', Date.now().toString());
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
                {!isSignUp && (
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="remember-main" 
                      checked={rememberMe} 
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label htmlFor="remember-main" className="text-sm font-normal cursor-pointer">
                      Keep me logged in for 30 days
                    </Label>
                  </div>
                )}
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
    <div className="min-h-screen bg-background overflow-x-hidden pb-safe">
      <Helmet>
        <title>Dashboard — Spider League</title>
        <meta name="description" content="Manage your spider fighters and compete in Spider League battles." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="canonical" href={`${window.location.origin}/`} />
      </Helmet>
      
      {/* Header */}
      <header className="glass-card border-b border-border/30 sticky top-0 z-40 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="flex-shrink-0">
                <img 
                  src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                  alt="Spider League Logo" 
                  className="h-10 sm:h-14 w-auto object-contain drop-shadow-lg"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent truncate">
                  Spider League
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <NotificationsDropdown />
              <Button variant="glass" size="icon" asChild className="h-10 w-10 sm:h-12 sm:w-12" title="My Spider Collection">
                <Link to="/collection">
                  <img 
                    src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                    alt="Spider" 
                    className="h-5 w-5 sm:h-6 sm:w-6 object-contain" 
                  />
                </Link>
              </Button>
              <HowItWorksModal />
              <UserProfileMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Online Users Bar */}
        <OnlineUsersBar />
        
        {/* Battle Recap Banner - Prominently displayed at the top */}
        <BattleRecapBanner />
        
        {/* My Spider Squad Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h2 className="text-xl sm:text-2xl font-bold">This Week's Eligible Spiders</h2>
                {userGlobalRank && (
                  <Badge variant="secondary" className="text-sm w-fit">
                    Global Rank #{userGlobalRank}
                  </Badge>
                )}
                <Badge variant="outline" className="text-sm w-fit">
                  {userSpiders.length}/3 Uploaded
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">You can upload up to 3 eligible spiders each week</p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to="/collection" className="flex items-center gap-2">
                <img 
                  src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                  alt="Spider" 
                  className="h-4 w-4 object-contain" 
                />
                View Full Collection
              </Link>
            </Button>
          </div>

          {spidersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : userSpiders.length === 0 ? (
            <Card className="border-2 border-dashed cursor-pointer hover:border-primary/70 transition-all" onClick={() => fileInputRef.current?.click()}>
              <CardContent className="pt-6 text-center py-16">
                <Upload className="h-20 w-20 text-primary mx-auto mb-6 opacity-80" />
                <h3 className="text-2xl font-bold mb-3">No Eligible Spiders This Week</h3>
                <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
                  Upload up to 3 spiders this week to make them eligible for battles and rankings!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    asChild 
                    className="gradient-button relative z-10 pulse-glow" 
                    size="lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link to="/upload" className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Upload Spider Now
                    </Link>
                  </Button>
                  <Button 
                    asChild 
                    variant="outline" 
                    size="lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link to="/collection" className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      View Full Collection
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Upload CTA Card - shown when user can upload more spiders */}
                {weeklyUploadCount < 3 && (
                  <Card className="border-2 border-dashed border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={handleUploadClick}>
                    <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                      <div className="inline-block cursor-pointer hover:scale-110 transition-transform duration-200 mb-4">
                        <Upload className="h-16 w-16 text-primary mx-auto opacity-90" />
                      </div>
                      <h4 className="font-bold text-xl mb-2">
                        {weeklyUploadCount === 0 ? 'Upload Your First Spider' : 
                         weeklyUploadCount === 1 ? 'Upload 2 More Spiders' :
                         'Upload 1 More Spider'}
                      </h4>
                      <p className="text-muted-foreground mb-4 text-sm">
                        {3 - weeklyUploadCount} {3 - weeklyUploadCount === 1 ? 'upload' : 'uploads'} remaining this week
                      </p>
                      <Button className="gradient-button pulse-glow w-full" size="lg" onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}>
                        <Plus className="h-5 w-5" />
                        Upload Spider Now
                      </Button>
                    </CardContent>
                  </Card>
                )}
                
                {userSpiders.map((spider) => (
                  <Card key={spider.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div 
                        className="cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => handleSpiderClick(spider)}
                      >
                        <div className="aspect-square relative mb-4 rounded-lg overflow-hidden">
                          <img 
                            src={spider.image_url} 
                            alt={spider.nickname}
                            className="w-full h-full object-cover"
                          />
                          <Badge 
                            className={`absolute top-2 right-2 ${rarityColors[spider.rarity]} text-white`}
                          >
                            {spider.rarity}
                          </Badge>
                        </div>
                        <div className="text-center space-y-3">
                          <div>
                            <h4 className="font-bold text-xl mb-1">{spider.nickname}</h4>
                            <p className="text-muted-foreground">{spider.species}</p>
                          </div>
                          <div className="flex justify-center">
                            <PowerScoreArc score={spider.power_score} size="medium" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Battle Button */}
                      {spider.is_approved && (
                        <BattleButton 
                          targetSpider={spider} 
                          size="default" 
                          variant="default"
                          context="collection"
                          className="w-full"
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="flex justify-center gap-3">
                <Button asChild variant="outline">
                  <Link to="/collection" className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    View Full Collection
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/battle-history" className="flex items-center gap-2">
                    <Sword className="h-4 w-4" />
                    Battle History
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Battle Recaps for Challengers */}
        <BattleRecapAlert />

        {/* Active Challenges Section */}
        <div className="mb-8">
          <ActiveChallengesPreview />
        </div>

        {/* Battle Mode Section */}
        <div className="mb-8">
          <BattleMode showChallenges={false} />
        </div>

        {/* Recent Battles Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2">Recent Battles</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Latest battles across all players
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
                <p className="text-muted-foreground">No battles have been fought yet. Be the first to battle!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentBattles.map((battle) => {
                const teamA = Array.isArray(battle.team_a) ? battle.team_a : [];
                const teamB = Array.isArray(battle.team_b) ? battle.team_b : [];
                const spiderA = teamA[0];
                const spiderB = teamB[0];
                
                let resultBadge;
                if (!battle.winner) {
                  resultBadge = <Badge variant="secondary">In Progress</Badge>;
                } else if (battle.winner === "TIE") {
                  resultBadge = <Badge variant="outline">Tie</Badge>;
                } else if (battle.winner === "A") {
                  resultBadge = <Badge className="bg-green-500 text-white">{spiderA?.nickname} Won</Badge>;
                } else {
                  resultBadge = <Badge className="bg-green-500 text-white">{spiderB?.nickname} Won</Badge>;
                }
                
                return (
                  <Card key={battle.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleBattleClick(battle)}>
                    <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        {/* Spider A - Fixed width container */}
                        <div className="flex items-center gap-2 sm:gap-3 w-32 sm:w-40 flex-shrink-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md overflow-hidden flex-shrink-0">
                            <img 
                              src={spiderA?.image_url} 
                              alt={spiderA?.nickname}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{spiderA?.nickname}</p>
                            <p className="text-xs text-muted-foreground truncate">{spiderA?.species}</p>
                          </div>
                        </div>
                        
                        {/* VS */}
                        <div className="flex-shrink-0 mx-2">
                          <span className="text-xs font-bold text-muted-foreground">VS</span>
                        </div>
                        
                        {/* Spider B - Fixed width container */}
                        <div className="flex items-center gap-2 sm:gap-3 w-32 sm:w-40 flex-shrink-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md overflow-hidden flex-shrink-0">
                            <img 
                              src={spiderB?.image_url} 
                              alt={spiderB?.nickname}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{spiderB?.nickname}</p>
                            <p className="text-xs text-muted-foreground truncate">{spiderB?.species}</p>
                          </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                <h2 className="text-xl sm:text-2xl font-bold">Leaderboards</h2>
                <div className="flex gap-2">
                  {/* All-Time vs Weekly Toggle */}
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
                  {/* Spiders vs Users Toggle */}
                  <div className="flex bg-muted rounded-lg p-1 w-fit">
                    <button
                      onClick={() => setLeaderboardView('spiders')}
                      className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                        leaderboardView === 'spiders' 
                          ? 'bg-background text-foreground shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Top Spiders
                    </button>
                    <button
                      onClick={() => setLeaderboardView('users')}
                      className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                        leaderboardView === 'users' 
                          ? 'bg-background text-foreground shadow-sm' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Top Users
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                {leaderboardType === 'weekly' ? 'This week\'s ' : 'All-time '}
                {leaderboardView === 'spiders' 
                  ? 'top 5 most powerful spider fighters'
                  : 'top 5 trainers by cumulative power scores'
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
          ) : leaderboardView === 'spiders' ? (
            // Spider Leaderboard
            topLeaderboardSpiders.length === 0 ? (
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
                          <p className="text-xs text-muted-foreground truncate hidden sm:block">
                            Owner: {spider.owner_id ? (
                              <ClickableUsername 
                                userId={spider.owner_id} 
                                displayName={ownerName}
                                className="text-foreground hover:text-primary"
                              />
                            ) : ownerName}
                          </p>
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
          )) : (
            // User Leaderboard
            topUsers.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No users yet</h3>
                  <p className="text-muted-foreground">Be the first to upload spiders and start competing!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {topUsers.map((user: any, index) => {
                  const rank = index + 1;
                  const userName = user.display_name || `User ${user.user_id.slice(0, 8)}`;
                  return (
                     <Card key={user.user_id} className={`hover:shadow-md transition-shadow ${rank <= 3 ? 'ring-1 ring-primary/20' : ''}`}>
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
                        
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                          {user.avatar_url ? (
                            <img 
                              src={user.avatar_url} 
                              alt={`${userName} avatar`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-sm font-bold text-muted-foreground">
                              {userName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        
                          <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 sm:gap-2 mb-1">
                                <ClickableUsername 
                                  userId={user.user_id} 
                                  displayName={userName}
                                  variant="ghost"
                                  className="font-semibold text-sm sm:text-base truncate hover:text-primary p-0 h-auto"
                                />
                               <Badge variant="outline" className="text-xs">
                                 {user.spider_count} Spider{user.spider_count !== 1 ? 's' : ''}
                               </Badge>
                             </div>
                             {user.top_spider && (
                               <button 
                                 onClick={() => handleSpiderClick({
                                   ...user.top_spider!,
                                   hit_points: 50, damage: 50, speed: 50, defense: 50, venom: 50, webcraft: 50,
                                   is_approved: true, owner_id: user.user_id, created_at: new Date().toISOString()
                                 })}
                                 className="text-xs sm:text-sm text-muted-foreground truncate hover:text-primary transition-colors cursor-pointer underline decoration-dotted underline-offset-2"
                               >
                                 Top: {user.top_spider.nickname} ({user.top_spider.power_score})
                               </button>
                             )}
                            <p className="text-xs text-muted-foreground">Collection Power Score</p>
                          </div>
                          
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-lg sm:text-xl font-bold">{user.total_power_score}</div>
                            <div className="text-xs text-muted-foreground">Total Power</div>
                          </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          )}
        </div>

      </main>
      
      {/* New Spider Spotlight Section */}
      {user && <NewSpiderSpotlight />}
      
      <SpiderDetailsModal
        spider={selectedSpider}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      
      <BattleDetailsModal
        isOpen={isBattleDetailsOpen}
        onClose={() => setIsBattleDetailsOpen(false)}
        battle={selectedBattle}
      />

      <UserProfileModal
        userId={selectedUserId}
        isOpen={isUserModalOpen}
        onClose={handleUserModalClose}
      />

      <BadgeNotification
        badge={newBadge}
        isVisible={showBadgeNotification}
        onDismiss={dismissBadgeNotification}
      />
      
      {/* Footer */}
      <footer className="border-t mt-16 py-8 bg-card/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground mb-4">
            © 2025 Spider League. Share spiders for friendly battles.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link 
              to="/shop" 
              className="text-primary hover:text-primary/80 transition-colors underline"
            >
              Shop
            </Link>
          </div>
        </div>
      </footer>

      {/* Spider Facts Ticker */}
      <div className="relative overflow-hidden bg-primary/10 border-t py-3">
        <div className="flex animate-scroll whitespace-nowrap">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="flex items-center">
              <span className="text-sm text-muted-foreground mx-8">🕷️ Spiders have been around for over 380 million years</span>
              <span className="text-sm text-muted-foreground mx-8">🕸️ Spider silk is stronger than steel of the same thickness</span>
              <span className="text-sm text-muted-foreground mx-8">🕷️ Most spiders have 8 eyes but some have 6, 4, 2, or even 0</span>
              <span className="text-sm text-muted-foreground mx-8">🕸️ Spiders can't fly but some species can "balloon" using their silk</span>
              <span className="text-sm text-muted-foreground mx-8">🕷️ The Goliath birdeater is the world's largest spider, reaching 12 inches</span>
              <span className="text-sm text-muted-foreground mx-8">🕸️ A spider's fangs are actually chelicerae - modified appendages</span>
              <span className="text-sm text-muted-foreground mx-8">🕷️ Jumping spiders can leap up to 50 times their body length</span>
              <span className="text-sm text-muted-foreground mx-8">🕸️ Some spiders can survive for months without food</span>
            </div>
          ))}
        </div>
      </div>

      <InstallPrompt />
      
      {/* Hidden file input for quick upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
};

export default Index;
