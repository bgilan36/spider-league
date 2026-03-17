import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, LogOut, Sparkles, Sword, Trophy, Upload, Users } from "lucide-react";

import { useAuth } from "@/auth/AuthProvider";
import ActiveChallengesPreview from "@/components/ActiveChallengesPreview";
import BattleDetailsModal from "@/components/BattleDetailsModal";
import BattleMode from "@/components/BattleMode";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import OnlineUsersBar from "@/components/OnlineUsersBar";
import { SpiderSkirmishCard } from "@/components/SpiderSkirmishCard";
import WeeklyEligibleSpiders from "@/components/WeeklyEligibleSpiders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RecentBattleSpider {
  id?: string;
  nickname: string;
  species: string;
  image_url: string;
  power_score?: number;
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
    loading: authLoading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    signInAsDemo,
  } = useAuth();
  const { toast } = useToast();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [recentBattles, setRecentBattles] = useState<RecentCombatItem[]>([]);
  const [battlesLoading, setBattlesLoading] = useState(true);
  const [selectedBattle, setSelectedBattle] = useState<any>(null);
  const [isBattleDetailsOpen, setIsBattleDetailsOpen] = useState(false);

  const isPublishedHost = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /(^|\.)spiderleague\.app$|(^|\.)spider-league\.lovable\.app$/i.test(window.location.hostname);
  }, []);

  const fetchRecentBattles = async () => {
    try {
      setBattlesLoading(true);

      const [{ data: battles, error: battlesError }, { data: skirmishes, error: skirmishesError }] = await Promise.all([
        supabase
          .from("battles")
          .select("*")
          .eq("is_active", false)
          .not("winner", "is", null)
          .order("created_at", { ascending: false })
          .limit(24),
        (supabase as any).rpc("get_recent_public_skirmishes", { row_limit: 24 }),
      ]);

      if (battlesError) throw battlesError;
      if (skirmishesError) {
        console.warn("Error fetching skirmishes for recent feed:", skirmishesError);
      }

      const recentBattleItems: RecentCombatItem[] = (battles || []).map((battle: any) => {
        const teamA = battle.team_a as any;
        const teamB = battle.team_b as any;

        return {
          id: `battle-${battle.id}`,
          created_at: battle.created_at,
          mode: "battle",
          winner: battle.winner,
          spider_a: teamA?.spider ?? teamA?.[0] ?? null,
          spider_b: teamB?.spider ?? teamB?.[0] ?? null,
          battle,
        };
      });

      const recentSkirmishItems: RecentCombatItem[] = ((skirmishes || []) as any[])
        .map((skirmish) => ({
          id: `skirmish-${skirmish.id}`,
          created_at: skirmish.created_at,
          mode: "skirmish" as const,
          winner: skirmish.winner_side ?? null,
          spider_a: skirmish.player_spider_snapshot ?? null,
          spider_b: skirmish.opponent_spider_snapshot ?? null,
        }))
        .filter((item) => !!item.spider_a && !!item.spider_b);

      setRecentBattles(
        [...recentBattleItems, ...recentSkirmishItems]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 24),
      );
    } catch (error) {
      console.error("Error fetching recent battles:", error);
      setRecentBattles([]);
    } finally {
      setBattlesLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void fetchRecentBattles();
      const channel = supabase
        .channel("homepage-recent-combat")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "battles" }, () => {
          void fetchRecentBattles();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    setRecentBattles([]);
    setBattlesLoading(false);
  }, [user]);

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) throw error;

        toast({
          title: "Account created",
          description: "Check your email to confirm your account.",
        });
      } else {
        if (rememberMe) {
          localStorage.setItem("rememberMe", Date.now().toString());
          sessionStorage.removeItem("tempSession");
        } else {
          localStorage.removeItem("rememberMe");
          sessionStorage.setItem("tempSession", "true");
        }

        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (error: any) {
      toast({
        title: isSignUp ? "Sign up failed" : "Sign in failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    localStorage.setItem("rememberMe", Date.now().toString());

    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: "Google sign-in failed",
        description: error.message,
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setSubmitting(true);
    const { error } = await signInAsDemo();

    if (error) {
      toast({
        title: "Demo sign-in failed",
        description: error.message,
        variant: "destructive",
      });
    }

    setSubmitting(false);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Helmet>
          <title>Spider League</title>
          <meta
            name="description"
            content="Upload spiders, discover matchups, and battle in Spider League."
          />
          <link rel="canonical" href={typeof window !== "undefined" ? `${window.location.origin}/` : "/"} />
        </Helmet>

        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <img
                src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png"
                alt="Spider League logo"
                className="h-20 w-auto"
              />
            </div>
            <h1 className="text-3xl font-bold">Spider League</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Battle with spiders you find in the wild.
            </p>
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
              <div className="mb-4 space-y-3">
                <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={submitting}>
                  Continue with Google
                </Button>
                {!isPublishedHost && (
                  <Button type="button" variant="secondary" className="w-full" onClick={handleDemoSignIn} disabled={submitting}>
                    🕷️ Sign in as Demo User (Development)
                  </Button>
                )}
                <div className="text-center text-xs text-muted-foreground">or continue with email</div>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4">
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
                    <Checkbox id="remember-main" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(Boolean(checked))} />
                    <Label htmlFor="remember-main" className="cursor-pointer text-sm font-normal">
                      Keep me logged in for 30 days
                    </Label>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isSignUp ? "Creating Account..." : "Signing In..."}
                    </>
                  ) : isSignUp ? (
                    "Create Account"
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Button
                  variant="link"
                  onClick={() => {
                    setIsSignUp((prev) => !prev);
                    setEmail("");
                    setPassword("");
                  }}
                >
                  {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Spider League Dashboard</title>
        <meta
          name="description"
          content="Manage your spiders, run skirmishes, and follow recent battles in Spider League."
        />
        <link rel="canonical" href={typeof window !== "undefined" ? `${window.location.origin}/` : "/"} />
      </Helmet>

      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold">Spider League</h1>
            <p className="text-sm text-muted-foreground">Skirmishes, battles, and weekly competition.</p>
          </div>

          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <Button asChild variant="outline" size="sm">
              <Link to="/upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-8 px-4 py-6 sm:px-6">
        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Practice mode</div>
                <div className="font-semibold">Spider Skirmishes</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <Sword className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">High stakes</div>
                <div className="font-semibold">Battles</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Community</div>
                <div className="font-semibold">Active players</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">History</div>
                <div className="font-semibold">Recent results</div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <WeeklyEligibleSpiders />
          </div>
          <div className="space-y-6 xl:col-span-5">
            <SpiderSkirmishCard />
            <ActiveChallengesPreview />
          </div>
        </section>

        <OnlineUsersBar />

        <BattleMode showChallenges={true} showBattleStats={false} showCreateChallengeButton={false} />

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Recent Battles and Skirmishes</h2>
              <p className="text-sm text-muted-foreground">Latest public combat activity across Spider League.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/battle-history">View All History</Link>
            </Button>
          </div>

          {battlesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : recentBattles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sword className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No recent combat yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Start a skirmish or battle to get the feed moving.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recentBattles.slice(0, 9).map((combat) => {
                const clickable = combat.mode === "battle" && combat.battle;
                const outcomeLabel =
                  combat.mode === "skirmish"
                    ? combat.winner === "A"
                      ? `${combat.spider_a?.nickname} won`
                      : `${combat.spider_b?.nickname} won`
                    : combat.winner === "A"
                      ? `${combat.spider_a?.nickname} won`
                      : combat.winner === "B"
                        ? `${combat.spider_b?.nickname} won`
                        : "Tie";

                return (
                  <Card
                    key={combat.id}
                    className={clickable ? "cursor-pointer transition-transform hover:scale-[1.01]" : undefined}
                    onClick={clickable ? () => {
                      setSelectedBattle(combat.battle);
                      setIsBattleDetailsOpen(true);
                    } : undefined}
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold capitalize">{combat.mode}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(combat.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="min-w-0 text-center">
                          {combat.spider_a?.image_url && (
                            <img
                              src={combat.spider_a.image_url}
                              alt={combat.spider_a.nickname}
                              className="mx-auto mb-2 h-20 w-20 rounded-xl object-cover"
                            />
                          )}
                          <div className="truncate font-semibold">{combat.spider_a?.nickname}</div>
                          <div className="truncate text-xs text-muted-foreground">{combat.spider_a?.species}</div>
                        </div>

                        <div className="text-sm font-bold text-muted-foreground">VS</div>

                        <div className="min-w-0 text-center">
                          {combat.spider_b?.image_url && (
                            <img
                              src={combat.spider_b.image_url}
                              alt={combat.spider_b.nickname}
                              className="mx-auto mb-2 h-20 w-20 rounded-xl object-cover"
                            />
                          )}
                          <div className="truncate font-semibold">{combat.spider_b?.nickname}</div>
                          <div className="truncate text-xs text-muted-foreground">{combat.spider_b?.species}</div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground">
                        {outcomeLabel}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <BattleDetailsModal
        isOpen={isBattleDetailsOpen}
        onClose={() => setIsBattleDetailsOpen(false)}
        battle={selectedBattle}
      />
    </div>
  );
};

export default Index;
