import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/auth/AuthProvider';
import { useAdminRole } from '@/hooks/useAdminRole';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  Bug,
  Sword,
  MessageSquare,
  TrendingUp,
  ArrowLeft,
  Activity,
  Calendar,
  BarChart3,
  PieChart,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  totalSpiders: number;
  newSpidersToday: number;
  newSpidersThisWeek: number;
  totalBattles: number;
  battlesToday: number;
  battlesThisWeek: number;
  totalWallPosts: number;
  wallPostsToday: number;
  activeChallenges: number;
}

interface DailyData {
  date: string;
  users: number;
  spiders: number;
  battles: number;
  wallPosts: number;
}

interface RarityDistribution {
  name: string;
  value: number;
  color: string;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: 'hsl(220 9% 46%)',
  UNCOMMON: 'hsl(142 71% 45%)',
  RARE: 'hsl(217 91% 60%)',
  EPIC: 'hsl(271 81% 56%)',
  LEGENDARY: 'hsl(45 93% 47%)',
};

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [rarityData, setRarityData] = useState<RarityDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      if (!isAdmin) {
        navigate('/');
        return;
      }
      fetchDashboardData();
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchDailyTrends(),
        fetchRarityDistribution(),
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const today = startOfDay(new Date());
    const weekAgo = subDays(today, 7);

    // Fetch all counts in parallel
    const [
      { count: totalUsers },
      { count: newUsersToday },
      { count: newUsersThisWeek },
      { count: totalSpiders },
      { count: newSpidersToday },
      { count: newSpidersThisWeek },
      { count: totalBattles },
      { count: battlesToday },
      { count: battlesThisWeek },
      { count: totalWallPosts },
      { count: wallPostsToday },
      { count: activeChallenges },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      supabase.from('spiders').select('*', { count: 'exact', head: true }).eq('is_approved', true),
      supabase.from('spiders').select('*', { count: 'exact', head: true }).eq('is_approved', true).gte('created_at', today.toISOString()),
      supabase.from('spiders').select('*', { count: 'exact', head: true }).eq('is_approved', true).gte('created_at', weekAgo.toISOString()),
      supabase.from('battles').select('*', { count: 'exact', head: true }),
      supabase.from('battles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('battles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      supabase.from('profile_wall_posts').select('*', { count: 'exact', head: true }),
      supabase.from('profile_wall_posts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('battle_challenges').select('*', { count: 'exact', head: true }).eq('status', 'OPEN').gt('expires_at', new Date().toISOString()),
    ]);

    setStats({
      totalUsers: totalUsers || 0,
      newUsersToday: newUsersToday || 0,
      newUsersThisWeek: newUsersThisWeek || 0,
      totalSpiders: totalSpiders || 0,
      newSpidersToday: newSpidersToday || 0,
      newSpidersThisWeek: newSpidersThisWeek || 0,
      totalBattles: totalBattles || 0,
      battlesToday: battlesToday || 0,
      battlesThisWeek: battlesThisWeek || 0,
      totalWallPosts: totalWallPosts || 0,
      wallPostsToday: wallPostsToday || 0,
      activeChallenges: activeChallenges || 0,
    });
  };

  const fetchDailyTrends = async () => {
    const days = 14;
    const dailyStats: DailyData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      const [
        { count: users },
        { count: spiders },
        { count: battles },
        { count: wallPosts },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString()),
        supabase.from('spiders').select('*', { count: 'exact', head: true })
          .eq('is_approved', true)
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString()),
        supabase.from('battles').select('*', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString()),
        supabase.from('profile_wall_posts').select('*', { count: 'exact', head: true })
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString()),
      ]);

      dailyStats.push({
        date: format(date, 'MMM dd'),
        users: users || 0,
        spiders: spiders || 0,
        battles: battles || 0,
        wallPosts: wallPosts || 0,
      });
    }

    setDailyData(dailyStats);
  };

  const fetchRarityDistribution = async () => {
    const { data: spiders, error } = await supabase
      .from('spiders')
      .select('rarity')
      .eq('is_approved', true);

    if (error) {
      console.error('Error fetching rarity distribution:', error);
      return;
    }

    const counts: Record<string, number> = {
      COMMON: 0,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0,
    };

    spiders?.forEach((spider) => {
      if (spider.rarity in counts) {
        counts[spider.rarity]++;
      }
    });

    setRarityData(
      Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        color: RARITY_COLORS[name],
      }))
    );
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | Spider League</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
                <p className="text-muted-foreground">Product usage analytics & insights</p>
              </div>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1.5">
              <Activity className="h-3 w-3" />
              Live Data
            </Badge>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Total Users"
              value={stats?.totalUsers ?? 0}
              subtitle={`+${stats?.newUsersThisWeek ?? 0} this week`}
              icon={Users}
              loading={loading}
              trend={stats?.newUsersToday ?? 0}
              trendLabel="today"
            />
            <StatCard
              title="Total Spiders"
              value={stats?.totalSpiders ?? 0}
              subtitle={`+${stats?.newSpidersThisWeek ?? 0} this week`}
              icon={Bug}
              loading={loading}
              trend={stats?.newSpidersToday ?? 0}
              trendLabel="today"
            />
            <StatCard
              title="Total Battles"
              value={stats?.totalBattles ?? 0}
              subtitle={`+${stats?.battlesThisWeek ?? 0} this week`}
              icon={Sword}
              loading={loading}
              trend={stats?.battlesToday ?? 0}
              trendLabel="today"
            />
            <StatCard
              title="Wall Posts"
              value={stats?.totalWallPosts ?? 0}
              subtitle={`${stats?.activeChallenges ?? 0} active challenges`}
              icon={MessageSquare}
              loading={loading}
              trend={stats?.wallPostsToday ?? 0}
              trendLabel="today"
            />
          </div>

          {/* Charts */}
          <Tabs defaultValue="trends" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="trends" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trends
              </TabsTrigger>
              <TabsTrigger value="breakdown" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Breakdown
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    14-Day Activity Trends
                  </CardTitle>
                  <CardDescription>
                    Daily signups, uploads, battles, and engagement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                        <YAxis className="text-muted-foreground text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="users"
                          stroke="hsl(221 83% 53%)"
                          strokeWidth={2}
                          name="New Users"
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="spiders"
                          stroke="hsl(142 71% 45%)"
                          strokeWidth={2}
                          name="New Spiders"
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="battles"
                          stroke="hsl(0 84% 60%)"
                          strokeWidth={2}
                          name="Battles"
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="wallPosts"
                          stroke="hsl(271 81% 56%)"
                          strokeWidth={2}
                          name="Wall Posts"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="breakdown" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Spider Rarity Distribution</CardTitle>
                    <CardDescription>Breakdown of spiders by rarity tier</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPie>
                          <Pie
                            data={rarityData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) =>
                              `${name} (${(percent * 100).toFixed(0)}%)`
                            }
                          >
                            {rarityData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Rarity Counts</CardTitle>
                    <CardDescription>Total spiders per rarity tier</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={rarityData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                          <XAxis type="number" className="text-muted-foreground text-xs" />
                          <YAxis
                            type="category"
                            dataKey="name"
                            className="text-muted-foreground text-xs"
                            width={80}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {rarityData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Daily Activity Comparison</CardTitle>
                  <CardDescription>Side-by-side comparison of key metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="date" className="text-muted-foreground text-xs" />
                        <YAxis className="text-muted-foreground text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar
                          dataKey="users"
                          fill="hsl(221 83% 53%)"
                          name="Users"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="spiders"
                          fill="hsl(142 71% 45%)"
                          name="Spiders"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="battles"
                          fill="hsl(0 84% 60%)"
                          name="Battles"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  loading: boolean;
  trend: number;
  trendLabel: string;
}

const StatCard = ({ title, value, subtitle, icon: Icon, loading, trend, trendLabel }: StatCardProps) => (
  <Card className="glass-card">
    <CardContent className="pt-6">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-3xl font-bold text-foreground mb-1">
            {value.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{subtitle}</span>
            {trend > 0 && (
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                +{trend} {trendLabel}
              </Badge>
            )}
          </div>
        </>
      )}
    </CardContent>
  </Card>
);

export default AdminDashboard;
