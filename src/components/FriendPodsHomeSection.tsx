import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Link2, Loader2, Share2, Sparkles, Sword, Trophy, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import PrivateLeagueStandings from "@/components/PrivateLeagueStandings";
import PrivateLeagueInvitePanel from "@/components/PrivateLeagueInvitePanel";
import { useStartSkillBattle } from "@/components/battle/useStartSkillBattle";
import {
  getCachedPodStandings,
  invalidatePodStandings,
  usePodStandings,
} from "@/hooks/usePodStandings";

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
  const { open: openSkillBattle, picker: skillBattlePicker } = useStartSkillBattle();
  const [pods, setPods] = useState<PodSwitcherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topStanding, setTopStanding] = useState<TopStanding | null>(null);
  const [latestBattle, setLatestBattle] = useState<RecentBattle | null>(null);
  const [memberCountForPanel, setMemberCountForPanel] = useState<number>(0);
  const [panelLoading, setPanelLoading] = useState(false);
  const [standingsTimeframe, setStandingsTimeframe] = useState<"weekly" | "all_time">("weekly");
  const [battleLoading, setBattleLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [mySpiders, setMySpiders] = useState<any[]>([]);
  const [opponentSpiders, setOpponentSpiders] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMySpiderId, setSelectedMySpiderId] = useState<string>("");
  const [selectedOpponentSpiderId, setSelectedOpponentSpiderId] = useState<string>("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const {
    standings: podStandings,
    loading: standingsLoading,
    refreshing: standingsRefreshing,
    refresh: refreshStandings,
  } = usePodStandings(selectedId, standingsTimeframe);

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
    const eligible = mySpiders.filter((s: any) => !s.onCooldown);
    if (eligible.length === 0) {
      if (selectedMySpiderId !== "") setSelectedMySpiderId("");
      return;
    }
    if (!selectedMySpiderId || !eligible.some((s: any) => s.id === selectedMySpiderId)) {
      setSelectedMySpiderId(eligible[0].id);
    }
  }, [mySpiders, selectedMySpiderId]);

  useEffect(() => {
    if (opponentSpiders.length === 0) {
      if (selectedOpponentSpiderId !== "") setSelectedOpponentSpiderId("");
      return;
    }
    const eligibleOpp = opponentSpiders.filter((s: any) => !s.onCooldown);
    if (eligibleOpp.length === 0) {
      if (selectedOpponentSpiderId !== "") setSelectedOpponentSpiderId("");
      return;
    }
    const top = eligibleOpp[0].id;
    if (!selectedOpponentSpiderId || !eligibleOpp.some((s: any) => s.id === selectedOpponentSpiderId)) {
      setSelectedOpponentSpiderId(top);
    }
  }, [opponentSpiders, selectedOpponentSpiderId]);

  useEffect(() => {
    if (!selectedId) return;
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, selectedId);
    let cancelled = false;
    // Only show the panel spinner when we have nothing to render yet.
    const cachedTopSync = getCachedPodStandings(selectedId, "weekly");
    setPanelLoading(!(cachedTopSync && cachedTopSync.length > 0));
    const loadPanel = async () => {
      // Serve cached weekly standings instantly while we refetch in the background.
      const cachedTop = getCachedPodStandings(selectedId, "weekly");
      if (cachedTop && cachedTop.length > 0 && !cancelled) {
        setTopStanding(cachedTop[0] as TopStanding);
      }
      const [{ data: standingData }, { data: battleData }, { data: memberRows }] = await Promise.all([
        (supabase as any).rpc("get_private_league_standings", { league_id: selectedId, timeframe: "weekly" }),
        (supabase as any)
          .from("battles")
          .select("id,created_at,winner,team_a,team_b")
          .eq("league_id", selectedId)
          .eq("is_active", false)
          .not("winner", "is", null)
          .order("created_at", { ascending: false })
          .limit(1),
        (supabase as any)
          .from("private_league_members")
          .select("user_id,profiles(display_name,avatar_url)")
          .eq("league_id", selectedId),
      ]);
      if (cancelled) return;
      const standings = (standingData || []) as TopStanding[];
      let top = standings[0] || null;
      // Fallback: if no weekly standings yet, surface a pod member with 0-0 so the UI stays informative.
      if (!top && memberRows && memberRows.length > 0) {
        const first = memberRows[0] as any;
        top = {
          user_id: first.user_id,
          display_name: first.profiles?.display_name || "Player",
          avatar_url: first.profiles?.avatar_url || null,
          wins: 0,
          losses: 0,
        };
      }
      setTopStanding(top);
      setMemberCountForPanel((memberRows || []).length);
      setLatestBattle((battleData || [])[0] || null);
      setPanelLoading(false);
    };
    loadPanel();
    // Fetch the active invite token for this pod so we can surface invite controls inline.
    setInviteToken(null);
    (supabase as any)
      .from("private_league_invites")
      .select("token")
      .eq("league_id", selectedId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!cancelled) setInviteToken(data?.token || null);
      });
    const channel = (supabase as any)
      .channel(`home-pod-battles-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battles", filter: `league_id=eq.${selectedId}` },
        (payload: any) => {
          console.log("[FriendPodsHome] battle change", payload?.eventType);
          setTimeout(() => {
            invalidatePodStandings(selectedId);
            loadPanel();
            refreshStandings();
          }, 300);
        },
      )
      .subscribe((status: string) => {
        console.log("[FriendPodsHome] realtime status", status);
      });
    const onFocus = () => { loadPanel(); };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      (supabase as any).removeChannel(channel);
      window.removeEventListener("focus", onFocus);
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
  const isSolo = (selectedPod?.member_count ?? memberCountForPanel) <= 1;
  const inviteUrl = inviteToken ? `${window.location.origin}/join/${inviteToken}` : "";

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
          .select("id,nickname,image_url,power_score,owner_id,rarity,level,last_battled_at")
          .eq("owner_id", user.id)
          .eq("is_approved", true)
          .gt("eligible_until", now)
          .order("power_score", { ascending: false }),
        opponentIds.length > 0
          ? (supabase as any)
              .from("spiders")
              .select("id,nickname,image_url,power_score,owner_id,rarity,level,last_battled_at")
              .in("owner_id", opponentIds)
              .eq("is_approved", true)
              .gt("eligible_until", now)
              .order("power_score", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);
      const cutoff = Date.now() - 4 * 60 * 60 * 1000;
      const decorate = (s: any) => {
        const last = s.last_battled_at ? new Date(s.last_battled_at).getTime() : 0;
        const onCooldown = last > cutoff;
        const cooldownRemainingMs = onCooldown ? last + 4 * 60 * 60 * 1000 - Date.now() : 0;
        return { ...s, onCooldown, cooldownRemainingMs };
      };
      const mineDecorated = (mine || []).map(decorate);
      const theirsDecorated = (theirs || []).map(decorate);
      mineDecorated.sort((a: any, b: any) => Number(a.onCooldown) - Number(b.onCooldown));
      theirsDecorated.sort((a: any, b: any) => Number(a.onCooldown) - Number(b.onCooldown));
      setMySpiders(mineDecorated);
      setOpponentSpiders(theirsDecorated);
      setSelectedMySpiderId(mineDecorated.find((s: any) => !s.onCooldown)?.id || "");
      setSelectedOpponentSpiderId(theirsDecorated.find((s: any) => !s.onCooldown)?.id || "");
    } finally {
      setPickerLoading(false);
    }
  };

  const startPodBattle = async () => {
    if (!selectedPod || !selectedMySpiderId || !selectedOpponentSpiderId) return;
    setPickerOpen(false);
    openSkillBattle({
      leagueId: selectedPod.id,
      spiderId: selectedMySpiderId,
      opponentSpiderId: selectedOpponentSpiderId,
    });
  };

  return (
    <Card className="overflow-hidden border-primary/20 bg-card/70">
      <CardContent className="space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Your pods</span>
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
            ) : isSolo ? (
              <div className="mt-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
                <div className="mb-1 flex items-center gap-2 text-primary">
                  <UserPlus className="h-5 w-5" />
                  <span className="text-sm font-semibold">You're flying solo</span>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  Pods are way more fun with friends. Invite someone to join and start battling.
                </p>
                {inviteUrl ? (
                  <PrivateLeagueInvitePanel inviteUrl={inviteUrl} memberCount={1} hideHeader />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Preparing invite link…
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2 text-xs">
                  <Trophy className="h-4 w-4 shrink-0 text-primary" />
                  {topStanding ? (
                    <span className="truncate">
                      <span className="font-semibold">{topStanding.display_name || "Player"}</span>
                      <span className="text-muted-foreground">
                        {topStanding.wins === 0 && topStanding.losses === 0
                          ? " · 0W–0L this week"
                          : ` leads (${topStanding.wins}W–${topStanding.losses}L this week)`}
                      </span>
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

            {!isSolo && (
              <>
                <div className="mt-3">
                  <PrivateLeagueStandings
                    standings={podStandings}
                    timeframe={standingsTimeframe}
                    onTimeframeChange={setStandingsTimeframe}
                    loading={standingsLoading}
                    refreshing={standingsRefreshing}
                  />
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setInviteDialogOpen(true)}
                    disabled={!inviteUrl}
                    className="gap-1"
                  >
                    <Share2 className="h-4 w-4" />
                    Invite
                  </Button>
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
                    Battle
                  </Button>
                </div>
              </>
            )}
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
                        onClick={() => !s.onCooldown && setSelectedMySpiderId(s.id)}
                        disabled={s.onCooldown}
                        title={s.onCooldown ? "On cooldown" : undefined}
                        className={`flex items-center gap-3 rounded-md border p-2 text-left transition ${s.onCooldown ? "cursor-not-allowed opacity-50 border-border" : selectedMySpiderId === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                      >
                        <img src={s.image_url} alt={s.nickname} className="h-12 w-12 rounded object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{s.nickname}</div>
                          <div className="text-xs text-muted-foreground">
                            PWR {s.power_score} · Lv {s.level}
                            {s.onCooldown && (
                              <span className="ml-2 text-amber-500">
                                · Cooldown {Math.max(1, Math.ceil(s.cooldownRemainingMs / 3600000))}h
                              </span>
                            )}
                          </div>
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
                          onClick={() => !s.onCooldown && setSelectedOpponentSpiderId(s.id)}
                          disabled={s.onCooldown}
                          title={s.onCooldown ? "On cooldown" : undefined}
                          className={`flex items-center gap-3 rounded-md border p-2 text-left transition ${s.onCooldown ? "cursor-not-allowed opacity-50 border-border" : selectedOpponentSpiderId === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                        >
                          <img src={s.image_url} alt={s.nickname} className="h-12 w-12 rounded object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{s.nickname}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {owner?.profiles?.display_name || "Pod member"} · PWR {s.power_score}
                              {s.onCooldown && (
                                <span className="ml-2 text-amber-500">
                                  · Cooldown {Math.max(1, Math.ceil(s.cooldownRemainingMs / 3600000))}h
                                </span>
                              )}
                            </div>
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
      {skillBattlePicker}

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite to {selectedPod?.name ?? "your pod"}</DialogTitle>
            <DialogDescription>Share this link with friends to add them to the pod.</DialogDescription>
          </DialogHeader>
          {inviteUrl ? (
            <PrivateLeagueInvitePanel
              inviteUrl={inviteUrl}
              memberCount={selectedPod?.member_count ?? memberCountForPanel}
              hideHeader
            />
          ) : (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FriendPodsHomeSection;