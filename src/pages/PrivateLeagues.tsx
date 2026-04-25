import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import CreatePrivateLeagueButton from "@/components/CreatePrivateLeagueButton";
import PodSwitcherStrip, { type PodSwitcherItem } from "@/components/PodSwitcherStrip";
import PrimaryPodPanel, { type PodMember, type PodRecentBattle } from "@/components/PrimaryPodPanel";

const STORAGE_KEY = "spiderleague:primaryPodId";

const PrivateLeagues = () => {
  const { user, loading: authLoading } = useAuth();
  const [pods, setPods] = useState<PodSwitcherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<PodMember[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [recentBattles, setRecentBattles] = useState<PodRecentBattle[]>([]);
  const [timeframe, setTimeframe] = useState<"weekly" | "all_time">("weekly");
  const [panelLoading, setPanelLoading] = useState(false);

  const fetchPods = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: memberships } = await (supabase as any)
      .from("private_league_members")
      .select("league_id, private_leagues!inner(id, name, is_active, image_url)")
      .eq("user_id", user.id);

    const active = (memberships || [])
      .filter((m: any) => m.private_leagues?.is_active)
      .map((m: any) => ({ id: m.private_leagues.id, name: m.private_leagues.name, image_url: m.private_leagues.image_url }));

    if (active.length === 0) {
      setPods([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    const { data: counts } = await (supabase as any)
      .from("private_league_members")
      .select("league_id")
      .in("league_id", active.map((l: any) => l.id));

    const countMap = new Map<string, number>();
    (counts || []).forEach((row: any) => countMap.set(row.league_id, (countMap.get(row.league_id) || 0) + 1));

    const items: PodSwitcherItem[] = active.map((l: any) => ({
      id: l.id,
      name: l.name,
      image_url: l.image_url,
      member_count: countMap.get(l.id) || 1,
    }));

    setPods(items);

    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const initial = stored && items.some((p) => p.id === stored) ? stored : items[0].id;
    setSelectedId(initial);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) fetchPods();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, fetchPods]);

  useEffect(() => {
    if (!selectedId) return;
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, selectedId);
    let cancelled = false;
    setPanelLoading(true);
    (async () => {
      const [{ data: memberData }, { data: standingData }, { data: battleData }] = await Promise.all([
        (supabase as any)
          .from("private_league_members")
          .select("user_id,role,joined_at,profiles(display_name,avatar_url)")
          .eq("league_id", selectedId)
          .order("joined_at"),
        (supabase as any).rpc("get_private_league_standings", { league_id: selectedId, timeframe }),
        (supabase as any)
          .from("battles")
          .select("id,created_at,winner,team_a,team_b")
          .eq("league_id", selectedId)
          .eq("is_active", false)
          .not("winner", "is", null)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;
      setMembers(memberData || []);
      setStandings(standingData || []);
      setRecentBattles(battleData || []);
      setPanelLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, timeframe]);

  if (!authLoading && !user) {
    return (
      <main className="container mx-auto px-4 py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="mb-2 text-2xl font-bold">Friend pods need sign-in</h1>
            <p className="mb-4 text-muted-foreground">Sign in to create or join private leagues.</p>
            <Button asChild><Link to="/auth">Sign in</Link></Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const selectedPod = pods.find((p) => p.id === selectedId) || null;

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>Friend Pods — Spider League</title>
        <meta name="description" content="Your friend pods at a glance: standings, recent battles, and members." />
      </Helmet>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link to="/"><ArrowLeft className="h-4 w-4" />Home</Link>
          </Button>
          <h1 className="text-3xl font-bold">Your pods</h1>
          <p className="text-muted-foreground">Beat your friends, not a giant global ladder.</p>
        </div>
        <CreatePrivateLeagueButton size="lg" onCreated={fetchPods} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : pods.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">No pods yet</h2>
            <p className="mb-4 text-muted-foreground">Create a league from your group chat and settle it in the Web Cage.</p>
            <CreatePrivateLeagueButton onCreated={fetchPods} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <PodSwitcherStrip
            pods={pods}
            selectedId={selectedId}
            onSelect={setSelectedId}
            createSlot={
              <div className="flex min-w-[180px] shrink-0 items-center justify-center rounded-lg border border-dashed border-border p-2">
                <CreatePrivateLeagueButton variant="ghost" size="sm" onCreated={fetchPods} />
              </div>
            }
          />
          {selectedPod && (
            <PrimaryPodPanel
              pod={selectedPod}
              members={members}
              standings={standings}
              recentBattles={recentBattles}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              loading={panelLoading}
            />
          )}
        </div>
      )}
    </main>
  );
};

export default PrivateLeagues;