import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, Users, Loader2, Sword, Bug, Heart, Camera, Target, Sparkles } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import CombatHub from "@/components/CombatHub";
import BattleDetailsModal from "@/components/BattleDetailsModal";
import ClickableUsername from "@/components/ClickableUsername";

import NotificationsDropdown from "@/components/NotificationsDropdown";
import OnlineUsersBar from "@/components/OnlineUsersBar";
import NewSpiderSpotlight from "@/components/NewSpiderSpotlight";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
import WeeklyEligibleSpiders from "@/components/WeeklyEligibleSpiders";
import { SpiderSkirmishCard } from "@/components/SpiderSkirmishCard";
import ActiveChallengesPreview from "@/components/ActiveChallengesPreview";
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

interface RecentBattleSpider {
  id?: string;
  nickname: string;
  species: string;
  image_url: string;
}

interface RecentCombatItem {
  id: string;
  created_at: string;
  mode: "battle" | "skirmish";
  winner: "A" | "B" | "TIE" | null;
  spider_a: RecentBattleSpider | null;
  spider_b: RecentBattleSpider | null;
  battle?: any;
}

const Index = () => {
  const {
    user,
    signOut,
    signIn,
    signUp,
    signInWithGoogle,
    signInAsDemo,
    loading: authLoading
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const {
    newBadge,
    showBadgeNotification,
    checkAndAwardBadges,
    dismissBadgeNotification
  } = useBadgeSystem();
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
  const [recentBattles, setRecentBattles] = useState<RecentCombatItem[]>([]);
  const [visibleRecentCount, setVisibleRecentCount] = useState(3);
  const [combatFilter, setCombatFilter] = useState<'all' | 'battle' | 'skirmish'>('all');
  const [battlesLoading, setBattlesLoading] = useState(true);
  const [selectedBattle, setSelectedBattle] = useState<any>(null);
  const [isBattleDetailsOpen, setIsBattleDetailsOpen] = useState(false);
  const [weeklyUploadCount, setWeeklyUploadCount] = useState(0);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [selectedTipAmount, setSelectedTipAmount] = useState<string>("5");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500",
    RARE: "bg-blue-500",
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500"
  };

  const normalizedTipAmount = useMemo(() => {
    const parsed = Number.parseFloat(selectedTipAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed.toFixed(2);
  }, [selectedTipAmount]);

  const venmoWebUrl = useMemo(() => {
    if (!normalizedTipAmount) return "https://venmo.com/u/Brian-Gilan";
    const params = new URLSearchParams({
      txn: "pay",
      amount: normalizedTipAmount,
      note: "Spider League tip",
    });
    return `https://venmo.com/u/Brian-Gilan?${params.toString()}`;
  }, [normalizedTipAmount]);

  const venmoAppUrl = useMemo(() => {
    if (!normalizedTipAmount) return "venmo://users/Brian-Gilan";
    const params = new URLSearchParams({
      txn: "pay",
      recipients: "Brian-Gilan",
      amount: normalizedTipAmount,
      note: "Spider League tip",
    });
    return `venmo://paycharge?${params.toString()}`;
  }, [normalizedTipAmount]);
  
  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    const refreshPromises: Promise<void>[] = [];
    
    if (user) {
      refreshPromises.push(fetchUserSpiders());
      refreshPromises.push(fetchUserGlobalRank());
      refreshPromises.push(fetchRecentBattles());
    }
    refreshPromises.push(fetchTopLeaderboardSpiders());
    refreshPromises.push(fetchTopUsers());
    
    await Promise.all(refreshPromises);
    toast({ title: "Refreshed", description: "Data updated successfully" });
    
    toast({
      title: "Refreshed",
      description: "Data updated successfully",
    });
  }, [user, leaderboardType]);
  
  const {
    isPulling,
    isRefreshing,
    pullDistance,
    progress,
    shouldTrigger,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: !isMobile,
  });
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
    const channel = supabase.channel('battles-updates').on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'battles'
    }, () => {
      // Refresh recent battles when a new battle is created
      fetchRecentBattles();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const fetchUserGlobalRank = async () => {
    if (!user) return;
    try {
      // Get user's current ELO rating
      const {
        data: userProfile,
        error: profileError
      } = await supabase.from('profiles').select('rating_elo').eq('id', user.id).single();
      if (profileError) throw profileError;
      if (userProfile?.rating_elo) {
        // Get rank by counting users with higher ELO
        const {
          count,
          error: rankError
        } = await supabase.from('profiles').select('*', {
          count: 'exact',
          head: true
        }).gt('rating_elo', userProfile.rating_elo);
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
      // Get the current week start from the database function to ensure consistency
      const { data: weekStartData, error: weekStartError } = await supabase
        .rpc('get_current_pt_week_start');
      
      if (weekStartError) throw weekStartError;
      
      // Convert the week start date to ISO timestamp for created_at comparison
      const weekStartISO = new Date(weekStartData + 'T00:00:00-08:00').toISOString();
      const {
        data: spidersThisWeek,
        error: spidersError
      } = await supabase.from('spiders').select('id, nickname, species, image_url, rarity, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved, created_at, owner_id').eq('owner_id', user.id).eq('is_approved', true).gte('created_at', weekStartISO).order('created_at', {
        ascending: true
      });
      if (spidersError) throw spidersError;

      // Get spiders with active challenges (regardless of upload date)
      const {
        data: activeChallenges,
        error: challengesError
      } = await supabase.from('battle_challenges').select('challenger_spider_id, accepter_spider_id').or(`challenger_id.eq.${user.id},accepter_id.eq.${user.id}`).eq('status', 'OPEN').gt('expires_at', new Date().toISOString());
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
        const {
          data: spidersWithChallenges,
          error: spidersWithChallengesError
        } = await supabase.from('spiders').select('id, nickname, species, image_url, rarity, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved, created_at, owner_id').in('id', Array.from(challengeSpiderIds)).eq('is_approved', true).eq('owner_id', user.id);
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

      const [
        {
          data: battles,
          error: battlesError
        },
        {
          data: skirmishes,
          error: skirmishesError
        }
      ] = await Promise.all([
        supabase.from('battles').select('*').eq('is_active', false).not('winner', 'is', null).order('created_at', {
          ascending: false
        }).limit(24),
        supabase.rpc('get_recent_public_skirmishes', { row_limit: 24 })
      ]);

      if (battlesError) throw battlesError;
      if (skirmishesError) {
        console.warn('Error fetching skirmishes for recent feed:', skirmishesError);
      }

      const recentBattleItems: RecentCombatItem[] = (battles || []).map((battle: any) => {
        const teamA = battle.team_a as any;
        const teamB = battle.team_b as any;
        const spiderA = teamA?.spider ?? teamA?.[0] ?? null;
        const spiderB = teamB?.spider ?? teamB?.[0] ?? null;
        return {
          id: `battle-${battle.id}`,
          created_at: battle.created_at,
          mode: 'battle' as const,
          winner: battle.winner,
          spider_a: spiderA ? { id: spiderA.id, nickname: spiderA.nickname, species: spiderA.species, image_url: spiderA.image_url } : null,
          spider_b: spiderB ? { id: spiderB.id, nickname: spiderB.nickname, species: spiderB.species, image_url: spiderB.image_url } : null,
          battle,
        };
      });

      const recentSkirmishItems: RecentCombatItem[] = ((skirmishes || []) as any[]).map((skirmish: any) => {
        const playerSpider = skirmish.player_spider_snapshot as any;
        const opponentSpider = skirmish.opponent_spider_snapshot as any;

        return {
          id: `skirmish-${skirmish.id}`,
          created_at: skirmish.created_at,
          mode: 'skirmish' as const,
          winner: skirmish.winner_side ?? null,
          spider_a: playerSpider ? { id: playerSpider.id, nickname: playerSpider.nickname, species: playerSpider.species, image_url: playerSpider.image_url } : null,
          spider_b: opponentSpider ? { id: opponentSpider.id, nickname: opponentSpider.nickname, species: opponentSpider.species, image_url: opponentSpider.image_url } : null,
        };
      }).filter((item: RecentCombatItem) => !!item.spider_a && !!item.spider_b);

      const mergedFeed = [...recentBattleItems, ...recentSkirmishItems]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 24);

      setRecentBattles(mergedFeed);
    } catch (error) {
      console.error('Error fetching recent battles:', error);
      setRecentBattles([]);
    } finally {
      setBattlesLoading(false);
    }
  };
  useEffect(() => {
    setVisibleRecentCount(3);
  }, [recentBattles.length]);

  const fetchTopLeaderboardSpiders = async () => {
    try {
      setLeaderboardLoading(true);

      if (leaderboardType === 'weekly') {
        // Weekly view: only include spiders uploaded during the current PT week
        const ptNow = new Date(
          new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
        );
        const dayOfWeek = ptNow.getDay(); // 0 = Sunday
        const weekStart = new Date(ptNow);
        weekStart.setDate(ptNow.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);

        const weekStartISO = weekStart.toISOString();

        const { data, error } = await supabase
          .from('spiders')
          .select(`
            id, nickname, species, image_url, rarity, power_score, hit_points, damage, speed, defense, venom, webcraft, is_approved, owner_id, created_at,
            profiles (
              display_name
            )
          `)
          .eq('is_approved', true)
          .gte('created_at', weekStartISO)
          .order('power_score', { ascending: false })
          .limit(5);

        if (error) throw error;
        setTopLeaderboardSpiders(data || []);
      } else {
        // All-time rankings: all approved spiders
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
      setTopLeaderboardSpiders([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };
  const fetchTopUsers = async () => {
    try {
      setLeaderboardLoading(true);

      if (leaderboardType === 'weekly') {
        const { data: currentWeekId, error: weekIdError } = await supabase.rpc('get_current_week');
        if (!weekIdError && currentWeekId) {
          const { data, error } = await supabase.rpc('get_user_rankings_weekly', {
            week_id_param: currentWeekId as string,
          });
          if (!error && data) {
            const normalized = (data as any[]).map((row) => ({
              ...row,
              total_power_score: row.week_power_score ?? 0,
              spider_count: row.week_spider_count ?? 0,
              ranking_score: row.ranking_score ?? ((row.week_power_score ?? 0) + (row.experience_points ?? 0)),
            }));
            setTopUsers(normalized.slice(0, 5));
            return;
          }
        }
      } else {
        const { data, error } = await supabase.rpc('get_user_rankings_all_time');
        if (!error && data) {
          const normalized = (data as any[]).map((row) => ({
            ...row,
            ranking_score: row.ranking_score ?? ((row.total_power_score ?? 0) + (row.experience_points ?? 0)),
          }));
          setTopUsers(normalized.slice(0, 5));
          return;
        }
      }

      // Fallback if leaderboard RPCs are unavailable locally.
      let fallbackQuery = supabase
        .from('spiders')
        .select(`
          owner_id,
          power_score,
          id,
          nickname,
          species,
          image_url,
          rarity,
          created_at,
          profiles!owner_id (
            display_name,
            avatar_url
          )
        `)
        .eq('is_approved', true);

      if (leaderboardType === 'weekly') {
        const ptNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
        const weekStart = new Date(ptNow);
        weekStart.setDate(ptNow.getDate() - ptNow.getDay());
        weekStart.setHours(0, 0, 0, 0);
        fallbackQuery = fallbackQuery.gte('created_at', weekStart.toISOString());
      }

      const { data: userRankings, error } = await fallbackQuery;
      if (error) throw error;

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
  const handleSpiderThumbnailClick = async (spiderId?: string) => {
    if (!spiderId) return;
    try {
      const { data, error } = await supabase
        .from('spiders')
        .select('*')
        .eq('id', spiderId)
        .single();
      if (error || !data) return;
      handleSpiderClick(data as Spider);
    } catch (e) {
      console.error('Error fetching spider:', e);
    }
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
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const {
        error
      } = isSignUp ? await signUp(email, password) : await signIn(email, password);
      if (error) {
        let message = error.message;
        if (error.message.includes("Invalid login credentials")) {
          message = "Invalid email or password";
        } else if (error.message.includes("User already registered")) {
          message = "This email is already registered. Try signing in instead.";
        }
        toast({
          title: "Authentication Error",
          description: message,
          variant: "destructive"
        });
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
          toast({
            title: "Account created!",
            description: "Please check your email to verify your account."
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "You've successfully signed in."
          });
        }
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>;
  }
  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <Helmet>
          <title>Spider League</title>
          <meta name="description" content="Upload spiders, generate stats, and battle in weekly matchups on Spider League." />
          <link rel="canonical" href={`${window.location.origin}/`} />
        </Helmet>
        <div className="w-full max-w-md px-6">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" alt="Spider League Logo" className="h-20 w-auto" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Spider League</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isSignUp ? "Create Account" : "Sign In"}</CardTitle>
              <CardDescription>
                {isSignUp ? "Create an account to start building your spider army" : "Welcome back! Sign in to your account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <Button type="button" variant="outline" className="w-full" onClick={async () => {
                setLoading(true);
                // Store remember preference with timestamp (default to true for Google auth)
                localStorage.setItem('rememberMe', Date.now().toString());
                const {
                  error
                } = await signInWithGoogle();
                if (error) {
                  toast({
                    title: "Google sign-in failed",
                    description: error.message,
                    variant: "destructive"
                  });
                  setLoading(false);
                }
                // On success, Supabase will redirect to Google and come back
              }} disabled={loading}>
                  {/* Simple Google "G" svg */}
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 533.5 544.3" aria-hidden="true">
                    <path fill="#EA4335" d="M533.5 278.4c0-18.5-1.7-37-5.3-54.9H272.1v103.9h147.1c-6.2 33.6-25.6 62-54.6 80.9v67h88.4c51.7-47.6 80.5-117.9 80.5-196.9z" />
                    <path fill="#34A853" d="M272.1 544.3c73.6 0 135.4-24.3 180.6-66.1l-88.4-67c-24.5 16.4-56 26-92.2 26-70.8 0-130.7-47.7-152.2-111.8H28.8v70.2c45 89.4 137.6 148.7 243.3 148.7z" />
                    <path fill="#4A90E2" d="M119.9 325.4c-10.3-30.9-10.3-64.6 0-95.5V159.7H28.8c-41.9 83.7-41.9 182.4 0 266.1l91.1-70.4z" />
                    <path fill="#FBBC05" d="M272.1 106.2c39.9-.6 78.2 14 107.5 41.1l80.1-80.1C413.1 24.6 343.7-1.2 272.1 0 166.4 0 73.8 59.3 28.8 148.7l91.1 70.2C141.4 154.8 201.3 106.9 272.1 106.2z" />
                  </svg>
                  Continue with Google
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={async () => {
                setLoading(true);
                const {
                  error
                } = await signInAsDemo();
                if (error) {
                  toast({
                    title: "Demo sign-in failed",
                    description: error.message,
                    variant: "destructive"
                  });
                } else {
                  toast({
                    title: "Signed in as Demo User",
                    variant: "default"
                  });
                }
                setLoading(false);
              }} disabled={loading}>
                  🕷️ Sign in as Demo User (Development)
                </Button>
                <div className="text-center text-xs text-muted-foreground">or continue with email</div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                {!isSignUp && <div className="flex items-center space-x-2">
                    <Checkbox id="remember-main" checked={rememberMe} onCheckedChange={checked => setRememberMe(checked as boolean)} />
                    <Label htmlFor="remember-main" className="text-sm font-normal cursor-pointer">
                      Keep me logged in for 30 days
                    </Label>
                  </div>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isSignUp ? "Creating Account..." : "Signing In..."}
                    </> : isSignUp ? "Create Account" : "Sign In"}
                </Button>
              </form>
              
              <div className="mt-4 text-center">
                <Button variant="link" onClick={() => {
                setIsSignUp(!isSignUp);
                setEmail("");
                setPassword("");
              }}>
                  {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <p className="text-center text-sm text-muted-foreground mt-6">
            Battle with spiders you find in the wild.
          </p>

          <section className="mt-10 border border-border/50 rounded-lg bg-card/40 p-4 sm:p-5">
            <h2 className="text-sm font-semibold mb-2">How Spider League Works</h2>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Take photos of real spiders you find in everyday life, upload them, and Spider League turns them into digital fighters with battle skills for your squad.</span>
              </li>
              <li className="flex items-start gap-2">
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Build your weekly battle roster from eligible spiders.</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Run quick skirmishes to earn XP and modest stat boosts for winning spiders.</span>
              </li>
              <li className="flex items-start gap-2">
                <Sword className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Enter battles against other players, where the winner can take ownership of the losing spider.</span>
              </li>
            </ul>
          </section>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background overflow-x-hidden pb-safe w-full max-w-full">
      {/* Pull to refresh indicator */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
        shouldTrigger={shouldTrigger}
      />
      <Helmet>
        <title>Dashboard — Spider League</title>
        <meta name="description" content="Manage your spider fighters and compete in Spider League battles." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="canonical" href={`${window.location.origin}/`} />
      </Helmet>
      
      {/* Header */}
      <header className="glass-card border-b border-border/30 sticky top-0 z-40 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="flex-shrink-0">
                <img src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" alt="Spider League Logo" className="h-9 sm:h-12 w-auto object-contain drop-shadow-lg" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent truncate">
                  Spider League
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <NotificationsDropdown />
              <Button variant="glass" size="icon" asChild className="h-10 w-10 sm:h-11 sm:w-11" title="My Spider Collection">
                <Link to="/collection">
                  <img src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" alt="Spider" className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />
                </Link>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="glass"
                    size="icon"
                    onClick={() => setTipModalOpen(true)}
                    className="h-10 w-10 sm:h-11 sm:w-11"
                    aria-label="Buy the devs a coffee"
                  >
                    <Heart className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="hidden sm:block">
                  Buy the devs a coffee
                </TooltipContent>
              </Tooltip>
              <HowItWorksModal />
              <UserProfileMenu />
            </div>
          </div>
        </div>
      </header>

      <Dialog open={tipModalOpen} onOpenChange={setTipModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Support Spider League</DialogTitle>
            <DialogDescription>
              Tip the devs on Venmo. Quick tip is $5, or enter your own amount.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={selectedTipAmount === "5" ? "default" : "outline"} onClick={() => setSelectedTipAmount("5")}>
                $5
              </Button>
              <Button type="button" variant={selectedTipAmount === "10" ? "default" : "outline"} onClick={() => setSelectedTipAmount("10")}>
                $10
              </Button>
              <Button type="button" variant={selectedTipAmount === "20" ? "default" : "outline"} onClick={() => setSelectedTipAmount("20")}>
                $20
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tip-amount">Custom amount (USD)</Label>
              <Input
                id="tip-amount"
                inputMode="decimal"
                placeholder="5.00"
                value={selectedTipAmount}
                onChange={(e) => setSelectedTipAmount(e.target.value)}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Venmo username: <span className="font-medium text-foreground">@Brian-Gilan</span>
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild disabled={!normalizedTipAmount}>
                <a href={venmoAppUrl}>Open Venmo App</a>
              </Button>
              <Button asChild variant="outline" disabled={!normalizedTipAmount}>
                <a href={venmoWebUrl} target="_blank" rel="noopener noreferrer">
                  Pay on Venmo Web
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto px-3 sm:px-6 py-3 sm:py-6">
        {/* Above-the-fold focus: weekly roster, skirmish, battle snapshot */}
        <section className="mb-8 grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <WeeklyEligibleSpiders onSpiderChange={fetchUserSpiders} />
          </div>

          <div className="xl:col-span-5">
            <CombatHub />
          </div>
        </section>

        {/* Below-the-fold content */}
        <div className="mb-6">
          <OnlineUsersBar />
        </div>


        {/* Combat Activity Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 sm:mb-2">Combat Activity</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Latest battles and spider skirmishes
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto min-h-[44px]">
              <Link to="/battle-history" className="flex items-center justify-center gap-2">
                <Sword className="h-4 w-4" />
                <span className="hidden sm:inline">View All History</span>
                <span className="sm:hidden">View All</span>
              </Link>
            </Button>
          </div>

          {/* Filter pills */}
          <div className="flex bg-muted rounded-lg p-1 w-fit mb-4">
            {([['all', 'All'], ['battle', 'Battles'], ['skirmish', 'Skirmishes']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => { setCombatFilter(value); setVisibleRecentCount(3); }}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  combatFilter === value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {battlesLoading ? <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div> : recentBattles.length === 0 ? <Card>
              <CardContent className="pt-6 text-center py-12">
                <Sword className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No recent combat yet</h3>
                <p className="text-muted-foreground">No battles or skirmishes have been recorded yet.</p>
              </CardContent>
            </Card> : (() => {
              const filteredBattles = recentBattles.filter(c => combatFilter === 'all' || c.mode === combatFilter);
              if (filteredBattles.length === 0) {
                return (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <p className="text-muted-foreground">No {combatFilter === 'battle' ? 'battles' : 'skirmishes'} found.</p>
                    </CardContent>
                  </Card>
                );
              }
              return <div className="space-y-3">
                {filteredBattles.slice(0, visibleRecentCount).map((combat) => {
              const spiderA = combat.spider_a;
              const spiderB = combat.spider_b;
              if (!spiderA || !spiderB) return null;
              const isBattleItem = combat.mode === "battle" && !!combat.battle;
              const isBattle = combat.mode === "battle";

              const winnerSide = combat.winner;
              const isWinnerA = winnerSide === "A";
              const isWinnerB = winnerSide === "B";

              let resultBadge;
              if (!combat.winner) {
                resultBadge = <Badge variant="secondary">In Progress</Badge>;
              } else if (combat.winner === "TIE") {
                resultBadge = <Badge variant="outline">Tie</Badge>;
              }

              return <Card
                      key={combat.id}
                      className={`${isBattleItem ? 'hover:shadow-md cursor-pointer' : 'cursor-default'} transition-shadow border-l-4 ${
                        isBattle ? 'border-l-destructive' : 'border-l-primary'
                      }`}
                      onClick={() => {
                        if (isBattleItem) {
                          handleBattleClick(combat.battle);
                        }
                      }}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-3">
                          {/* Spider A */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div
                              className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 rounded-md transition-all"
                              onClick={(e) => { e.stopPropagation(); handleSpiderThumbnailClick(spiderA?.id); }}
                            >
                              <div className="w-full h-full rounded-md overflow-hidden">
                                <img src={spiderA?.image_url} alt={spiderA?.nickname} className="w-full h-full object-cover" />
                              </div>
                              {isWinnerA && (
                                <Trophy className="absolute -top-1.5 -right-1.5 h-4 w-4 text-yellow-500 drop-shadow-md" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{spiderA?.nickname}</p>
                              <p className="text-xs text-muted-foreground truncate">{spiderA?.species}</p>
                            </div>
                          </div>
                          
                          {/* VS */}
                          <span className="text-xs font-bold text-muted-foreground flex-shrink-0">VS</span>
                          
                          {/* Spider B */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div
                              className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 rounded-md transition-all"
                              onClick={(e) => { e.stopPropagation(); handleSpiderThumbnailClick(spiderB?.id); }}
                            >
                              <div className="w-full h-full rounded-md overflow-hidden">
                                <img src={spiderB?.image_url} alt={spiderB?.nickname} className="w-full h-full object-cover" />
                              </div>
                              {isWinnerB && (
                                <Trophy className="absolute -top-1.5 -right-1.5 h-4 w-4 text-yellow-500 drop-shadow-md" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{spiderB?.nickname}</p>
                              <p className="text-xs text-muted-foreground truncate">{spiderB?.species}</p>
                            </div>
                          </div>
                          
                          {/* Mode, Result, Date */}
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-1 max-w-[110px] sm:max-w-none">
                            <div className={`flex items-center gap-1 text-xs font-medium ${isBattle ? 'text-destructive' : 'text-primary'}`}>
                              {isBattle ? <Sword className="h-3 w-3" /> : <Bug className="h-3 w-3" />}
                              {isBattle ? 'Battle' : 'Skirmish'}
                            </div>
                            {resultBadge && <div className="max-w-full [&>span]:max-w-full [&>span]:truncate [&>span]:block">{resultBadge}</div>}
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(combat.created_at), 'MMM d')}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 whitespace-nowrap hidden sm:block">
                              {isBattle ? 'Stakes: Spider Transfer' : 'Stakes: XP Only'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>;
            })}

                {filteredBattles.length > visibleRecentCount ? (
                  <div className="pt-2 text-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setVisibleRecentCount((count) => count + 3)}
                      className="min-w-32"
                    >
                      See more
                    </Button>
                  </div>
                ) : null}
              </div>;
            })()}
        </div>

        {/* Leaderboard Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Leaderboards</h2>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto min-h-[44px]">
                <Link to="/leaderboard" className="flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">View Full Leaderboard</span>
                  <span className="sm:hidden">Leaderboard</span>
                </Link>
              </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              {/* All-Time vs Weekly Toggle */}
              <div className="flex bg-muted rounded-lg p-1 w-full sm:w-fit">
                <button onClick={() => setLeaderboardType('alltime')} className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-medium rounded-md transition-colors min-h-[44px] ${leaderboardType === 'alltime' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  All-Time
                </button>
                <button onClick={() => setLeaderboardType('weekly')} className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-medium rounded-md transition-colors min-h-[44px] ${leaderboardType === 'weekly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  Weekly
                </button>
              </div>
              {/* Spiders vs Users Toggle */}
              <div className="flex bg-muted rounded-lg p-1 w-full sm:w-fit">
                <button onClick={() => setLeaderboardView('spiders')} className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-medium rounded-md transition-colors min-h-[44px] ${leaderboardView === 'spiders' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  Top Spiders
                </button>
                <button onClick={() => setLeaderboardView('users')} className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-medium rounded-md transition-colors min-h-[44px] ${leaderboardView === 'users' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  Top Users
                </button>
              </div>
            </div>
            
            <p className="text-xs sm:text-sm text-muted-foreground">
              {leaderboardType === 'weekly' ? 'This week\'s ' : 'All-time '}
              {leaderboardView === 'spiders' ? 'top 5 most powerful spider fighters' : 'top 5 trainers by power + XP'}
            </p>
          </div>

          {leaderboardLoading ? <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div> : leaderboardView === 'spiders' ?
        // Spider Leaderboard
        topLeaderboardSpiders.length === 0 ? <Card>
                <CardContent className="pt-6 text-center py-12">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No spiders yet</h3>
                  <p className="text-muted-foreground">Be the first to upload a spider and claim the top spot!</p>
                </CardContent>
              </Card> : <div className="space-y-3">
              {topLeaderboardSpiders.map((spider, index) => {
            const rank = index + 1;
            const ownerName = (spider as any).profiles?.display_name || `User ${spider.owner_id?.slice(0, 8)}`;
            return <Card key={spider.id} className={`hover:shadow-md transition-shadow ${rank <= 3 ? 'ring-1 ring-primary/20' : ''}`}>
                    <CardContent className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <div className="w-7 sm:w-8 text-center flex items-center justify-center">
                          {rank === 1 && <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />}
                          {rank === 2 && <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />}
                          {rank === 3 && <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />}
                          {rank > 3 && <span className="font-bold text-base sm:text-lg">#{rank}</span>}
                        </div>
                      </div>
                      
                      <div
                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        onClick={(e) => { e.stopPropagation(); handleSpiderClick(spider); }}
                      >
                        <img src={spider.image_url} alt={spider.nickname} className="w-full h-full object-cover" />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 mb-1">
                          <h4 className="font-semibold text-sm sm:text-base truncate">{spider.nickname}</h4>
                          <Badge className={`text-[10px] sm:text-xs ${rarityColors[spider.rarity]} text-white w-fit`}>
                            {spider.rarity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-0.5">{spider.species}</p>
                        {spider.created_at && <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
                            Uploaded: {format(new Date(spider.created_at), 'MMM d, yyyy')}
                          </p>}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-base sm:text-lg md:text-xl font-bold">{spider.power_score}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">Power</div>
                        </div>
                        <BattleButton targetSpider={spider} size="sm" variant="outline" context="leaderboard" className="hidden sm:flex" />
                      </div>
                    </CardContent>
                  </Card>;
          })}
            </div> :
        // User Leaderboard
        topUsers.length === 0 ? <Card>
                <CardContent className="pt-6 text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No users yet</h3>
                  <p className="text-muted-foreground">Be the first to upload spiders and start competing!</p>
                </CardContent>
              </Card> : <div className="space-y-3">
                {topUsers.map((user: any, index) => {
            const rank = index + 1;
            const userName = user.display_name || `User ${user.user_id.slice(0, 8)}`;
            return <Card key={user.user_id} className={`hover:shadow-md transition-shadow ${rank <= 3 ? 'ring-1 ring-primary/20' : ''}`}>
                      <CardContent className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <div className="w-7 sm:w-8 text-center flex items-center justify-center">
                            {rank === 1 && <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />}
                            {rank === 2 && <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />}
                            {rank === 3 && <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />}
                            {rank > 3 && <span className="font-bold text-base sm:text-lg">#{rank}</span>}
                          </div>
                        </div>
                        
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                          {user.avatar_url ? <img src={user.avatar_url} alt={`${userName} avatar`} className="w-full h-full object-cover" /> : <div className="text-base sm:text-lg font-bold text-muted-foreground">
                              {userName.charAt(0).toUpperCase()}
                            </div>}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 mb-1">
                            <ClickableUsername userId={user.user_id} displayName={userName} variant="ghost" className="font-semibold text-sm sm:text-base truncate hover:text-primary p-0 h-auto" />
                            <Badge variant="outline" className="text-[10px] sm:text-xs w-fit">
                              {user.spider_count} Spider{user.spider_count !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {user.top_spider && <button onClick={() => handleSpiderClick({
                    ...user.top_spider!,
                    hit_points: 50,
                    damage: 50,
                    speed: 50,
                    defense: 50,
                    venom: 50,
                    webcraft: 50,
                    is_approved: true,
                    owner_id: user.user_id,
                    created_at: new Date().toISOString()
                  })} className="text-[10px] sm:text-xs text-muted-foreground truncate hover:text-primary transition-colors cursor-pointer underline decoration-dotted underline-offset-2 text-left">
                            Top: {user.top_spider.nickname} ({user.top_spider.power_score})
                          </button>}
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <div className="text-base sm:text-lg md:text-xl font-bold">{user.ranking_score ?? user.total_power_score}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">Power + XP</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">
                            XP {user.experience_points ?? 0}
                          </div>
                        </div>
                      </CardContent>
                    </Card>;
          })}
              </div>}
        </div>

      </main>
      
      {/* New Spider Spotlight Section */}
      {user && <NewSpiderSpotlight />}
      
      {/* Feedback Card */}
      {user && <div className="container mx-auto px-3 sm:px-6 mt-8 sm:mt-12 mb-6 sm:mb-8">
          <a href="https://forms.gle/66uF4PESgaQb9U5r5" target="_blank" rel="noopener noreferrer" className="block">
            <Card className="cursor-pointer hover:scale-[1.02] transition-transform duration-300 bg-gradient-to-br from-primary/10 via-background to-secondary/10 border-primary/20">
              <CardContent className="p-6 sm:p-8 text-center">
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Help Shape Spider League
                </h3>
                <p className="text-muted-foreground text-sm sm:text-base mb-3 sm:mb-4">We need your beta user feedback to help us make Spider League better.</p>
                <div className="inline-flex items-center gap-2 text-primary font-semibold text-sm sm:text-base">
                  <span>Submit Feedback</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </CardContent>
            </Card>
          </a>
        </div>}
      
      <SpiderDetailsModal spider={selectedSpider} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <BattleDetailsModal isOpen={isBattleDetailsOpen} onClose={() => setIsBattleDetailsOpen(false)} battle={selectedBattle} />

      <UserProfileModal userId={selectedUserId} isOpen={isUserModalOpen} onClose={handleUserModalClose} />

      <BadgeNotification badge={newBadge} isVisible={showBadgeNotification} onDismiss={dismissBadgeNotification} />
      
      {/* Footer */}
      <footer className="border-t mt-12 sm:mt-16 py-6 sm:py-8 bg-card/30">
        <div className="container mx-auto px-3 sm:px-6 text-center">
          <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4">
            © 2025 Spider League. Share spiders for friendly battles.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/shop" className="text-primary hover:text-primary/80 transition-colors underline text-sm">
              Shop
            </Link>
          </div>
        </div>
      </footer>

      {/* Spider Facts Ticker */}
      <div className="relative overflow-hidden bg-primary/10 border-t py-2 sm:py-3 w-full max-w-full">
        <div className="flex animate-scroll whitespace-nowrap">
          {[...Array(2)].map((_, index) => <div key={index} className="flex items-center">
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕷️ Spiders have been around for over 380 million years</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕸️ Spider silk is stronger than steel of the same thickness</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕷️ Most spiders have 8 eyes but some have 6, 4, 2, or even 0</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕸️ Spiders can't fly but some species can "balloon" using their silk</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕷️ The Goliath birdeater is the world's largest spider, reaching 12 inches</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕸️ A spider's fangs are actually chelicerae - modified appendages</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕷️ Jumping spiders can leap up to 50 times their body length</span>
              <span className="text-xs sm:text-sm text-muted-foreground mx-6 sm:mx-8">🕸️ Some spiders can survive for months without food</span>
            </div>)}
        </div>
      </div>

      
      
      {/* Hidden file input for quick upload */}
      <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleFileSelect} />
    </div>;
};
export default Index;
