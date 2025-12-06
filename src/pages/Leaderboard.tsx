import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Trophy, Medal, Award, ArrowLeft, Crown, Star, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PowerScoreArc from "@/components/PowerScoreArc";
import SpiderDetailsModal from "@/components/SpiderDetailsModal";
import BattleButton from "@/components/BattleButton";
import { UserProfileModal } from "@/components/UserProfileModal";
import ClickableUsername from "@/components/ClickableUsername";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { useIsMobile } from "@/hooks/use-mobile";
interface Spider {
  id: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score: number;
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  is_approved: boolean;
  owner_id: string;
  created_at: string;
  profiles: {
    display_name: string | null;
  } | null;
}

interface UserRanking {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_power_score: number;
  spider_count: number;
  top_spider: {
    id: string;
    nickname: string;
    species: string;
    image_url: string;
    power_score: number;
    rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
  } | null;
}

interface WeeklyUserRanking {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  week_power_score: number;
  week_spider_count: number;
  spiders_acquired_in_battle: number;
  top_spider: {
    id: string;
    nickname: string;
    species: string;
    image_url: string;
    power_score: number;
    rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
  } | null;
}

interface Week {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  season_id: string;
}

const Leaderboard = () => {
  const { toast } = useToast();
  const [topUsers, setTopUsers] = useState<UserRanking[]>([]);
  const [weeklyUserRankings, setWeeklyUserRankings] = useState<WeeklyUserRanking[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [currentWeekId, setCurrentWeekId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all-time" | "weekly">("all-time");
  const [selectedSpider, setSelectedSpider] = useState<Spider | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const handleSpiderClick = (spider: Spider) => {
    setSelectedSpider(spider);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSpider(null);
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setIsUserModalOpen(true);
  };

  const handleUserModalClose = () => {
    setIsUserModalOpen(false);
    setSelectedUserId(null);
  };

  const rarityColors = {
    COMMON: "bg-gray-500",
    UNCOMMON: "bg-green-500", 
    RARE: "bg-blue-500",
    EPIC: "bg-purple-500",
    LEGENDARY: "bg-amber-500",
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" />;
    if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    if (rank <= 10) return <Award className="h-5 w-5 text-primary" />;
    return <Star className="h-4 w-4 text-muted-foreground" />;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "1st";
    if (rank === 2) return "2nd"; 
    if (rank === 3) return "3rd";
    return `${rank}th`;
  };

  const isMobile = useIsMobile();

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      fetchTopUsers(),
      fetchWeeks(),
      ...(activeTab === "weekly" && selectedWeekId ? [fetchWeeklyUserRankings(selectedWeekId)] : [])
    ]);
  }, [activeTab, selectedWeekId]);

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
    fetchTopUsers();
    fetchWeeks();
  }, []);

  useEffect(() => {
    if (activeTab === "weekly" && selectedWeekId) {
      fetchWeeklyUserRankings(selectedWeekId);
    }
  }, [activeTab, selectedWeekId]);

  const fetchTopUsers = async () => {
    try {
      setLoading(true);

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
      const userMap = new Map<string, UserRanking>();
      
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
        .sort((a, b) => b.total_power_score - a.total_power_score)
        .slice(0, 100);

      setTopUsers(sortedUsers);
    } catch (error: any) {
      console.error("Error fetching user leaderboard:", error);
      toast({ 
        title: "Error loading leaderboard", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeks = async () => {
    try {
      // Get all weeks
      const { data: weeksData, error } = await supabase
        .from('weeks')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;

      // Check if we need to create the current week
      const now = new Date();
      const hasCurrentWeek = weeksData?.some(week => {
        const startDate = new Date(week.start_date);
        const endDate = new Date(week.end_date);
        return now >= startDate && now <= endDate;
      });

      // If no current week exists, create a dynamic "current week" entry
      let finalWeeksData = weeksData || [];
      if (!hasCurrentWeek) {
        // Calculate current week boundaries (Sunday to Saturday)
        const currentDate = new Date();
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Create a temporary current week object
        const currentWeek = {
          id: 'current-week',
          week_number: (weeksData?.[0]?.week_number || 0) + 1,
          start_date: weekStart.toISOString(),
          end_date: weekEnd.toISOString(),
          season_id: weeksData?.[0]?.season_id || 'default-season',
          is_locked: false,
          created_at: new Date().toISOString()
        };

        finalWeeksData = [currentWeek, ...finalWeeksData];
      }

      setWeeks(finalWeeksData);
      
      // Set current week (most recent) as default
      if (finalWeeksData.length > 0) {
        const currentWeek = finalWeeksData[0];
        setCurrentWeekId(currentWeek.id);
        setSelectedWeekId(currentWeek.id);
      }
    } catch (error: any) {
      console.error("Error fetching weeks:", error);
      toast({ 
        title: "Error loading weeks", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const fetchWeeklyUserRankings = async (weekId: string) => {
    try {
      setLoading(true);

      // Get week dates first
      const { data: week, error: weekError } = await supabase
        .from('weeks')
        .select('start_date, end_date')
        .eq('id', weekId)
        .single();

      if (weekError) throw weekError;

      // Only get spiders created during this specific week
      const { data: weekSpiders, error: spiderError } = await supabase
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
        .eq('is_approved', true)
        .gte('created_at', week.start_date)
        .lte('created_at', week.end_date);

      if (spiderError) throw spiderError;

      // Process the data to calculate weekly user scores
      const userMap = new Map<string, WeeklyUserRanking>();
      
      // Process spiders created this week
      weekSpiders?.forEach((spider: any) => {
        const userId = spider.owner_id;
        const existing = userMap.get(userId);
        
        if (existing) {
          existing.week_power_score += spider.power_score;
          existing.week_spider_count += 1;
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
            week_power_score: spider.power_score,
            week_spider_count: 1,
            spiders_acquired_in_battle: 0,
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

      // Convert to array and sort by weekly power score
      const sortedUsers = Array.from(userMap.values())
        .sort((a, b) => b.week_power_score - a.week_power_score)
        .slice(0, 100);

      setWeeklyUserRankings(sortedUsers);
    } catch (error: any) {
      console.error("Error fetching weekly user rankings:", error);
      toast({ 
        title: "Error loading weekly rankings", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const formatWeekLabel = (week: Week) => {
    const start = new Date(week.start_date).toLocaleDateString();
    const end = new Date(week.end_date).toLocaleDateString();
    const isCurrent = week.id === currentWeekId;
    return `Week ${week.week_number}${isCurrent ? ' (Current)' : ''} - ${start} to ${end}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading user leaderboard...</p>
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
        <title>User Leaderboard — Spider League</title>
        <meta name="description" content="View the top-ranked spider trainers by cumulative power scores." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="canonical" href={`${window.location.origin}/leaderboard`} />
      </Helmet>
      
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-safe">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Back to Home</span>
              <span className="sm:hidden">Home</span>
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-xs sm:text-sm font-medium">Leaderboard</span>
        </div>
        
        <div className="flex items-center justify-center mb-6 sm:mb-8">
          <div className="text-center">
            <div className="flex justify-center mb-3 sm:mb-4">
              <img 
                src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                alt="Spider League Logo" 
                className="h-12 sm:h-16 w-auto"
              />
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">User Leaderboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Top trainers ranked by cumulative power scores</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all-time" | "weekly")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 sm:mb-8">
            <TabsTrigger value="all-time" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Trophy className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">All-Time Rankings</span>
              <span className="sm:hidden">All-Time</span>
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Weekly Rankings</span>
              <span className="sm:hidden">Weekly</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all-time">
            {renderUserLeaderboard(topUsers, "all-time")}
          </TabsContent>

          <TabsContent value="weekly">
            <div className="space-y-6">
              {weeks.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold">Select Week:</h3>
                    <Select value={selectedWeekId} onValueChange={setSelectedWeekId}>
                      <SelectTrigger className="w-80">
                        <SelectValue placeholder="Choose a week" />
                      </SelectTrigger>
                      <SelectContent>
                        {weeks.map((week) => (
                          <SelectItem key={week.id} value={week.id}>
                            {formatWeekLabel(week)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {renderUserLeaderboard(weeklyUserRankings, "weekly")}
            </div>
          </TabsContent>
        </Tabs>

        <SpiderDetailsModal
          spider={selectedSpider}
          isOpen={isModalOpen}
          onClose={handleModalClose}
        />

        <UserProfileModal
          userId={selectedUserId}
          isOpen={isUserModalOpen}
          onClose={handleUserModalClose}
        />
      </main>
    </div>
  );

  function renderUserLeaderboard(users: UserRanking[] | WeeklyUserRanking[], type: "all-time" | "weekly") {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading {type === "weekly" ? "weekly" : "all-time"} user rankings...</p>
          </div>
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <Card className="text-center py-12">
          <CardContent>
            <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {type === "weekly" ? "No Weekly Data" : "No Users Yet"}
            </h3>
            <p className="text-muted-foreground">
              {type === "weekly" 
                ? "No user rankings available for this week."
                : "Be the first to upload spiders and claim the top spot!"
              }
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Top 3 Featured */}
        {users.slice(0, 3).length > 0 && (
          <div className="space-y-4 mb-8">
            {users.slice(0, 3).map((user, index) => {
              const rank = index + 1;
              const userName = user.display_name || `User ${user.user_id.slice(0, 8)}`;
              const isWeekly = type === "weekly";
              const powerScore = isWeekly ? (user as WeeklyUserRanking).week_power_score : (user as UserRanking).total_power_score;
              const spiderCount = isWeekly ? (user as WeeklyUserRanking).week_spider_count : (user as UserRanking).spider_count;
              const battleSpiders = isWeekly ? (user as WeeklyUserRanking).spiders_acquired_in_battle : 0;
              
              return (
                <Card key={user.user_id} className={`${rank === 1 ? 'ring-2 ring-amber-500' : ''} hover:shadow-lg transition-all`}>
                  <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-6">
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                      {getRankIcon(rank)}
                      <Badge variant="secondary" className="font-bold text-base sm:text-lg px-2 sm:px-3 py-1">
                        {getRankBadge(rank)}
                      </Badge>
                    </div>
                    
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={`${userName} avatar`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-xl sm:text-2xl font-bold text-muted-foreground">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <ClickableUsername 
                          userId={user.user_id} 
                          displayName={userName}
                          variant="ghost"
                          className="font-bold text-lg sm:text-xl hover:text-primary p-0 h-auto"
                        />
                        <Badge variant="outline" className="text-xs">
                          {spiderCount} Spider{spiderCount !== 1 ? 's' : ''}
                        </Badge>
                        {isWeekly && battleSpiders > 0 && (
                          <Badge variant="secondary" className="bg-red-500 text-white text-xs">
                            +{battleSpiders}
                          </Badge>
                        )}
                      </div>
                      {user.top_spider && (
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Top Spider:</p>
                          <button 
                            onClick={() => handleSpiderClick({
                              ...user.top_spider!,
                              hit_points: 50, damage: 50, speed: 50, defense: 50, venom: 50, webcraft: 50,
                              is_approved: true, owner_id: user.user_id, created_at: new Date().toISOString()
                            })}
                            className="text-xs sm:text-sm font-medium hover:text-primary transition-colors cursor-pointer underline decoration-dotted underline-offset-2 truncate max-w-[200px]"
                          >
                            {user.top_spider.nickname}
                          </button>
                          <Badge 
                            variant="secondary" 
                            className={`${rarityColors[user.top_spider.rarity]} text-white text-xs flex-shrink-0`}
                          >
                            {user.top_spider.rarity}
                          </Badge>
                        </div>
                      )}
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {isWeekly ? 'Weekly' : 'Total'} Collection Power Score
                      </p>
                    </div>
                    
                    <div className="text-right flex-shrink-0 w-full sm:w-auto sm:ml-4 border-t sm:border-t-0 pt-3 sm:pt-0">
                      <div className="text-2xl sm:text-3xl font-bold">{powerScore}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">Power Score</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Rest of the leaderboard */}
        <div className="space-y-2">
          {users.slice(3).map((user, index) => {
            const rank = index + 4;
            const userName = user.display_name || `User ${user.user_id.slice(0, 8)}`;
            const isWeekly = type === "weekly";
            const powerScore = isWeekly ? (user as WeeklyUserRanking).week_power_score : (user as UserRanking).total_power_score;
            const spiderCount = isWeekly ? (user as WeeklyUserRanking).week_spider_count : (user as UserRanking).spider_count;
            const battleSpiders = isWeekly ? (user as WeeklyUserRanking).spiders_acquired_in_battle : 0;
            
            return (
              <Card key={user.user_id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-1 sm:gap-2 w-12 sm:w-16 flex-shrink-0">
                      {getRankIcon(rank)}
                      <span className="font-bold text-base sm:text-lg">#{rank}</span>
                    </div>
                    
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={`${userName} avatar`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-base sm:text-lg font-bold text-muted-foreground">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                       <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                          <ClickableUsername 
                            userId={user.user_id} 
                            displayName={userName}
                            variant="ghost"
                            className="font-semibold text-sm sm:text-base truncate hover:text-primary p-0 h-auto max-w-[120px] sm:max-w-none"
                          />
                         <Badge variant="outline" className="text-xs flex-shrink-0">
                           {spiderCount} Spider{spiderCount !== 1 ? 's' : ''}
                         </Badge>
                        {isWeekly && battleSpiders > 0 && (
                          <Badge variant="secondary" className="bg-red-500 text-white text-xs flex-shrink-0">
                            +{battleSpiders}
                          </Badge>
                        )}
                      </div>
                      {user.top_spider && (
                        <button 
                          onClick={() => handleSpiderClick({
                            ...user.top_spider!,
                            hit_points: 50, damage: 50, speed: 50, defense: 50, venom: 50, webcraft: 50,
                            is_approved: true, owner_id: user.user_id, created_at: new Date().toISOString()
                          })}
                          className="text-xs text-muted-foreground truncate hover:text-primary transition-colors cursor-pointer underline decoration-dotted underline-offset-2 max-w-[200px] block"
                        >
                          Top: {user.top_spider.nickname} ({user.top_spider.power_score})
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0 w-full sm:w-auto sm:ml-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-xl sm:text-2xl font-bold">{powerScore}</div>
                    <div className="text-xs text-muted-foreground">Power Score</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }
};

export default Leaderboard;
