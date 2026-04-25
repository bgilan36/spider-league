import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Loader2, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import CreatePrivateLeagueButton from "@/components/CreatePrivateLeagueButton";
import PodSwitcherStrip, { type PodSwitcherItem } from "@/components/PodSwitcherStrip";
import PodThumbnail from "@/components/PodThumbnail";

const STORAGE_KEY = "spiderleague:primaryPodId";

interface RecentBattle {
  id: string;
  created_at: string;
  winner: string | null;
  team_a: any;
  team_b: any;
}

interface TopStanding {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
}

const getSpider = (team: any) => team?.spider ?? team?.[0] ?? null;

const FriendPodsHomeSection = () => {
  const { user } = useAuth();
  const [pods, setPods] = useState<PodSwitcherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topStanding, setTopStanding] = useState<TopStanding | null>(null);
  const [latestBattle, setLatestBattle] = useState<RecentBattle | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  const fetchPods = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: memberships } = await (supabase as any)
      .from("private_league_members")
      .select("league_id, private_leagues!inner(id, name, is_active, image_url)")
      .eq("user_id", user.id);

    const active = (memberships || [])
      .filter((m: any) => m.private_leagues?.is_active)
      .map((m: any) => ({
        id: m.private_leagues.id,
        name: m.private_leagues.name,
        image_url: m.private_leagues.image_url,
      }));

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
    setSelectedId(stored && items.some((p) => p.id === stored) ? stored : items[0].id);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  useEffect(() => {
    if (!selectedId) return;
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, selectedId);
    let cancelled = false;
    setPanelLoading(true);
    (async () => {
      const [{ data: standingData }, { data: battleData }] = await Promise.all([
        (supabase as any).rpc("get_private_league_standings", { league_id: selectedId, timeframe: "weekly" }),
        (supabase as any)
          .from("battles")
          .select("id,created_at,winner,team_a,team_b")
          .eq("league_id", selectedId)
          .eq("is_active", false)
          .not("winner", "is", null)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;
      const standings = (standingData || []) as TopStanding[];
      setTopStanding(standings[0] || null);
      setLatestBattle((battleData || [])[0] || null);
      setPanelLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (loading) {
    return (
      <Card className="overflow-hidden border-primary/20 bg-card/70">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!user || pods.length === 0) {
    return (
      <Card className="overflow-hidden border-primary/20 bg-card/70">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Friend pods</span>
            </div>
            <h2 className="text-xl font-bold sm:text-2xl">Compete with your friends</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a private league for your group chat and see who rules the pod.
            </p>
          </div>
          <div className="sm:min-w-56">
            <CreatePrivateLeagueButton size="lg" className="w-full" onCreated={fetchPods} />
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedPod = pods.find((p) => p.id === selectedId) || null;

  return (
    <Card className="overflow-hidden border-primary/20 bg-card/70">
      <CardContent className="space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Your friend pods</span>
          </div>
          <CreatePrivateLeagueButton size="sm" variant="outline" onCreated={fetchPods} />
        </div>

        <PodSwitcherStrip
          pods={pods}
          selectedId={selectedId}
          onSelect={setSelectedId}
          createSlot={<div className="hidden" />}
        />

        {selectedPod && (
          <Link
            to={`/leagues/${selectedPod.id}`}
            className="group block rounded-lg border border-border bg-background/40 p-3 transition hover:border-primary/60 hover:bg-primary/5"
          >
            <div className="flex items-center gap-3">
              <PodThumbnail imageUrl={selectedPod.image_url} podName={selectedPod.name} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold group-hover:text-primary">{selectedPod.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedPod.member_count} {selectedPod.member_count === 1 ? "member" : "members"}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>

            {panelLoading ? (
              <div className="mt-3 flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2 text-xs">
                  <Trophy className="h-4 w-4 shrink-0 text-primary" />
                  {topStanding ? (
                    <span className="truncate">
                      <span className="font-semibold">{topStanding.display_name || "Player"}</span>
                      <span className="text-muted-foreground"> leads ({topStanding.wins}W–{topStanding.losses}L this week)</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No standings yet this week</span>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2 text-xs">
                  {latestBattle ? (
                    <>
                      {(() => {
                        const a = getSpider(latestBattle.team_a);
                        const b = getSpider(latestBattle.team_b);
                        const winner = latestBattle.winner === "A" ? a : latestBattle.winner === "B" ? b : null;
                        const loser = latestBattle.winner === "A" ? b : latestBattle.winner === "B" ? a : null;
                        return (
                          <span className="truncate">
                            <span className="font-semibold">{winner?.nickname || "Spider"}</span>
                            <span className="text-muted-foreground"> beat {loser?.nickname || "opponent"} · {formatDistanceToNow(new Date(latestBattle.created_at), { addSuffix: true })}</span>
                          </span>
                        );
                      })()}
                    </>
                  ) : (
                    <span className="text-muted-foreground">No pod battles yet</span>
                  )}
                </div>
              </div>
            )}
          </Link>
        )}

        {selectedPod && (
          <div className="flex justify-end">
            <Button asChild variant="ghost" size="sm">
              <Link to={`/leagues/${selectedPod.id}`}>Open pod<ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FriendPodsHomeSection;