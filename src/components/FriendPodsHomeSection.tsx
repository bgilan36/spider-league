import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Loader2, Sword, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pods, setPods] = useState<PodSwitcherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topStanding, setTopStanding] = useState<TopStanding | null>(null);
  const [latestBattle, setLatestBattle] = useState<RecentBattle | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [battleLoading, setBattleLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [mySpiders, setMySpiders] = useState<any[]>([]);
  const [opponentSpiders, setOpponentSpiders] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMySpiderId, setSelectedMySpiderId] = useState<string>("");
  const [selectedOpponentSpiderId, setSelectedOpponentSpiderId] = useState<string>("");

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
    if (mySpiders.length === 0) {
      if (selectedMySpiderId !== "") setSelectedMySpiderId("");
      return;
    }
    const top = mySpiders[0].id;
    if (!selectedMySpiderId || !mySpiders.some((s) => s.id === selectedMySpiderId)) {
      setSelectedMySpiderId(top);
    }
  }, [mySpiders, selectedMySpiderId]);

  useEffect(() => {
    if (opponentSpiders.length === 0) {
      if (selectedOpponentSpiderId !== "") setSelectedOpponentSpiderId("");
      return;
    }
    const top = opponentSpiders[0].id;
    if (!selectedOpponentSpiderId || !opponentSpiders.some((s) => s.id === selectedOpponentSpiderId)) {
      setSelectedOpponentSpiderId(top);
    }
  }, [opponentSpiders, selectedOpponentSpiderId]);

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

  const openPicker = async () => {
    if (!selectedPod || !user) return;
    setPickerOpen(true);
    setPickerLoading(true);
    try {
      const now = new Date().toISOString();
      const { data: memberRows } = await (supabase as any)
        .from("private_league_members")
        .select("user_id,profiles(display_name,avatar_url)")
        .eq("league_id", selectedPod.id);
      const memberList = memberRows || [];
      setMembers(memberList);
      const opponentIds = memberList
        .map((m: any) => m.user_id)
        .filter((id: string) => id !== user.id);
      const [{ data: mine }, { data: theirs }] = await Promise.all([
        (supabase as any)
          .from("spiders")
          .select("id,nickname,image_url,power_score,owner_id,rarity,level")
          .eq("owner_id", user.id)
          .eq("is_approved", true)
          .gt("eligible_until", now)
          .order("power_score", { ascending: false }),
        opponentIds.length > 0
          ? (supabase as any)
              .from("spiders")
              .select("id,nickname,image_url,power_score,owner_id,rarity,level")
              .in("owner_id", opponentIds)
              .eq("is_approved", true)
              .gt("eligible_until", now)
              .order("power_score", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);
      setMySpiders(mine || []);
      setOpponentSpiders(theirs || []);
      setSelectedMySpiderId(mine?.[0]?.id || "");
      setSelectedOpponentSpiderId(theirs?.[0]?.id || "");
    } finally {
      setPickerLoading(false);
    }
  };

  const startPodBattle = async () => {
    if (!selectedPod || !selectedMySpiderId || !selectedOpponentSpiderId) return;
    setBattleLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("quick-battle", {
        body: {
          leagueId: selectedPod.id,
          spiderId: selectedMySpiderId,
          opponentSpiderId: selectedOpponentSpiderId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Pod battle complete", description: "Opening the replay." });
      navigate(`/battle/${data.battleId}`);
    } catch (err: any) {
      toast({ title: "Can't start pod battle", description: err.message, variant: "destructive" });
    } finally {
      setBattleLoading(false);
      setPickerOpen(false);
    }
  };

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
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
            <Link
              to={`/leagues/${selectedPod.id}`}
              className="group flex items-center gap-3"
            >
              <PodThumbnail imageUrl={selectedPod.image_url} podName={selectedPod.name} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold group-hover:text-primary">{selectedPod.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedPod.member_count} {selectedPod.member_count === 1 ? "member" : "members"}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>

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
                    <span className="text-muted-foreground">Standings update after the first pod battle</span>
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

            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                size="sm"
                onClick={openPicker}
                disabled={battleLoading}
                className="gap-1"
              >
                {battleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sword className="h-4 w-4" />
                )}
                Battle a member
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to={`/leagues/${selectedPod.id}`}>Open pod<ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose your battle</DialogTitle>
            <DialogDescription>Pick your spider and the pod member's spider you want to face.</DialogDescription>
          </DialogHeader>
          {pickerLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Your spider</h3>
                {mySpiders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No eligible spiders. Upload or re-enlist one to battle.</p>
                ) : (
                  <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                    {mySpiders.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedMySpiderId(s.id)}
                        className={`flex items-center gap-3 rounded-md border p-2 text-left transition ${selectedMySpiderId === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                      >
                        <img src={s.image_url} alt={s.nickname} className="h-12 w-12 rounded object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{s.nickname}</div>
                          <div className="text-xs text-muted-foreground">PWR {s.power_score} · Lv {s.level}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Pod opponent</h3>
                {opponentSpiders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pod members have eligible spiders right now.</p>
                ) : (
                  <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                    {opponentSpiders.map((s) => {
                      const owner = members.find((m) => m.user_id === s.owner_id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedOpponentSpiderId(s.id)}
                          className={`flex items-center gap-3 rounded-md border p-2 text-left transition ${selectedOpponentSpiderId === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                        >
                          <img src={s.image_url} alt={s.nickname} className="h-12 w-12 rounded object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{s.nickname}</div>
                            <div className="truncate text-xs text-muted-foreground">{owner?.profiles?.display_name || "Pod member"} · PWR {s.power_score}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)} disabled={battleLoading}>Cancel</Button>
            <Button onClick={startPodBattle} disabled={battleLoading || pickerLoading || !selectedMySpiderId || !selectedOpponentSpiderId} className="gap-1">
              {battleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sword className="h-4 w-4" />}
              Start battle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FriendPodsHomeSection;