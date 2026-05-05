import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Settings, Share2, Swords, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import PrivateLeagueInvitePanel from "@/components/PrivateLeagueInvitePanel";
import PrivateLeagueStandings from "@/components/PrivateLeagueStandings";
import PodChat from "@/components/PodChat";
import PodImageUploader from "@/components/PodImageUploader";
import { useStartSkillBattle } from "@/components/battle/useStartSkillBattle";
import { usePodStandings, invalidatePodStandings } from "@/hooks/usePodStandings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PrivateLeagueDetail = () => {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { open: openSkillBattle, picker: skillBattlePicker } = useStartSkillBattle();
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [battleLoading, setBattleLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mySpiders, setMySpiders] = useState<any[]>([]);
  const [opponentSpiders, setOpponentSpiders] = useState<any[]>([]);
  const [selectedMySpiderId, setSelectedMySpiderId] = useState<string>("");
  const [selectedOpponentSpiderId, setSelectedOpponentSpiderId] = useState<string>("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<"weekly" | "all_time">("weekly");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const {
    standings,
    loading: standingsLoading,
    refreshing: standingsRefreshing,
    refresh: refreshStandings,
  } = usePodStandings(leagueId ?? null, timeframe);

  const inviteUrl = useMemo(() => invite?.token ? `${window.location.origin}/join/${invite.token}` : "", [invite]);

  const fetchLeague = useCallback(async () => {
    if (!leagueId || !user) return;
    setLoading(true);
    const [{ data: leagueData }, { data: memberData }, { data: inviteData }] = await Promise.all([
      (supabase as any).from("private_leagues").select("*").eq("id", leagueId).maybeSingle(),
      (supabase as any).from("private_league_members").select("user_id,role,joined_at,profiles(display_name,avatar_url)").eq("league_id", leagueId).order("joined_at"),
      (supabase as any).from("private_league_invites").select("token").eq("league_id", leagueId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setLeague(leagueData);
    setMembers(memberData || []);
    setInvite(inviteData);
    setLoading(false);
  }, [leagueId, user]);

  useEffect(() => { fetchLeague(); }, [fetchLeague]);

  // Live-refresh standings/members when a battle in this pod is inserted or updated
  useEffect(() => {
    if (!leagueId) return;
    const channel = (supabase as any)
      .channel(`pod-battles-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battles", filter: `league_id=eq.${leagueId}` },
        (payload: any) => {
          console.log("[PrivateLeagueDetail] battle change", payload?.eventType);
          // Small delay so the battle row is fully visible to subsequent SELECTs/RPC calls
          setTimeout(() => {
            if (leagueId) invalidatePodStandings(leagueId);
            fetchLeague();
            refreshStandings();
          }, 300);
        },
      )
      .subscribe((status: string) => {
        console.log("[PrivateLeagueDetail] realtime status", status);
      });
    const onFocus = () => {
      fetchLeague();
      refreshStandings();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      (supabase as any).removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [leagueId, fetchLeague, refreshStandings]);

  const openPicker = async () => {
    if (!leagueId || !user) return;
    setPickerOpen(true);
    setPickerLoading(true);
    const now = new Date().toISOString();
    const opponentIds = members.map((m) => m.user_id).filter((id) => id !== user.id);
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
    const cutoff = Date.now() - 60 * 60 * 1000;
    const decorate = (s: any) => {
      const last = s.last_battled_at ? new Date(s.last_battled_at).getTime() : 0;
      const onCooldown = last > cutoff;
      const cooldownRemainingMs = onCooldown ? last + 60 * 60 * 1000 - Date.now() : 0;
      return { ...s, onCooldown, cooldownRemainingMs };
    };
    const mineDecorated = (mine || []).map(decorate);
    const theirsDecorated = (theirs || []).map(decorate);
    // Sort eligible first
    mineDecorated.sort((a: any, b: any) => Number(a.onCooldown) - Number(b.onCooldown));
    theirsDecorated.sort((a: any, b: any) => Number(a.onCooldown) - Number(b.onCooldown));
    setMySpiders(mineDecorated);
    setOpponentSpiders(theirsDecorated);
    setSelectedMySpiderId(mineDecorated.find((s: any) => !s.onCooldown)?.id || "");
    setSelectedOpponentSpiderId(theirsDecorated.find((s: any) => !s.onCooldown)?.id || "");
    setPickerLoading(false);
  };

  const startPodBattle = async () => {
    if (!leagueId || !selectedMySpiderId || !selectedOpponentSpiderId) return;
    setPickerOpen(false);
    openSkillBattle({
      leagueId,
      spiderId: selectedMySpiderId,
      opponentSpiderId: selectedOpponentSpiderId,
    });
  };

  if (loading) return <main className="container mx-auto px-4 py-10"><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div></main>;
  if (!league) return <main className="container mx-auto px-4 py-10"><Card><CardContent className="py-10 text-center"><h1 className="mb-2 text-2xl font-bold">Pod not found</h1><Button asChild><Link to="/leagues">Back to pods</Link></Button></CardContent></Card></main>;

  const isMember = !!user && members.some((m) => m.user_id === user.id);
  const isCommissioner = !!user && league.owner_id === user.id;

  const handleDeletePod = async () => {
    if (!leagueId || !isCommissioner) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from("private_leagues")
        .update({ is_active: false })
        .eq("id", leagueId);
      if (error) throw error;
      toast({ title: "Pod deleted", description: `${league.name} has been removed.` });
      navigate("/leagues");
    } catch (error: any) {
      toast({ title: "Couldn't delete pod", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  const openRename = () => {
    setRenameValue(league?.name || "");
    setRenameOpen(true);
  };

  const handleRenamePod = async () => {
    if (!leagueId || !isCommissioner) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast({ title: "Name required", description: "Pod name can't be empty.", variant: "destructive" });
      return;
    }
    if (trimmed === league.name) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      const { error } = await (supabase as any)
        .from("private_leagues")
        .update({ name: trimmed })
        .eq("id", leagueId);
      if (error) throw error;
      setLeague((prev: any) => ({ ...prev, name: trimmed }));
      toast({ title: "Pod renamed", description: `Now called ${trimmed}.` });
      setRenameOpen(false);
    } catch (error: any) {
      toast({ title: "Couldn't rename pod", description: error.message, variant: "destructive" });
    } finally {
      setRenaming(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet><title>{league.name} — Spider League Pod</title><meta name="description" content="Private Spider League pod standings and battles." /></Helmet>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="mb-2"><Link to="/leagues"><ArrowLeft className="h-4 w-4" />Pods</Link></Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <PodImageUploader
              leagueId={league.id}
              imageUrl={league.image_url}
              podName={league.name}
              canEdit={isMember}
              onUpdated={(url) => setLeague((prev: any) => ({ ...prev, image_url: url }))}
            />
            <div className="min-w-0">
              <h1 className="text-3xl font-bold">{league.name}</h1>
              <p className="text-muted-foreground">Beat your friends inside this pod.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {inviteUrl && (
            <Button variant="outline" size="lg" onClick={() => setInviteOpen(true)}>
              <Share2 className="h-4 w-4" />Invite
            </Button>
          )}
          {isCommissioner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" aria-label="Commissioner settings">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Commissioner settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openRename(); }}>
                  <Pencil className="h-4 w-4" />
                  Rename pod
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => { e.preventDefault(); setConfirmDeleteOpen(true); }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete pod
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Primary action: prominent, centered Battle CTA */}
      <div className="mb-6 flex justify-center">
        <Button
          onClick={openPicker}
          disabled={battleLoading || members.length < 2}
          size="lg"
          className="w-full sm:w-auto sm:min-w-[280px] h-14 text-base shadow-glow"
        >
          {battleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />}
          Battle Now
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <PrivateLeagueStandings
            standings={standings}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            loading={standingsLoading}
            refreshing={standingsRefreshing}
          />
          <PodChat leagueId={leagueId!} members={members} />
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-primary" />Members</CardTitle></CardHeader><CardContent className="space-y-2">{members.map((member) => <div key={member.user_id} className="flex items-center gap-3 rounded-md border border-border p-3"><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">{member.profiles?.avatar_url ? <img src={member.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : <span>{(member.profiles?.display_name || "P").charAt(0)}</span>}</div><div className="flex-1"><div className="font-medium">{member.profiles?.display_name || `Player ${member.user_id.slice(0, 6)}`}</div><div className="text-xs capitalize text-muted-foreground">{member.role === "owner" ? "Commissioner" : member.role}</div></div></div>)}</CardContent></Card>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite friends to {league.name}</DialogTitle>
            <DialogDescription>Share this link in your group chat. No account needed until they choose to join.</DialogDescription>
          </DialogHeader>
          {inviteUrl && <PrivateLeagueInvitePanel inviteUrl={inviteUrl} memberCount={members.length} hideHeader />}
        </DialogContent>
      </Dialog>

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
                                · Cooldown {Math.max(1, Math.ceil(s.cooldownRemainingMs / 60000))}m
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
                                  · Cooldown {Math.max(1, Math.ceil(s.cooldownRemainingMs / 60000))}m
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
            <Button onClick={startPodBattle} disabled={battleLoading || pickerLoading || !selectedMySpiderId || !selectedOpponentSpiderId}>
              {battleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              Start battle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {league.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deactivates the pod for everyone. Members will no longer see it in their pod list. This can't be undone from the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePod}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete pod
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename pod</DialogTitle>
            <DialogDescription>Pick a new name your pod members will see.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pod-name">Pod name</Label>
            <Input
              id="pod-name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={60}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleRenamePod(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={renaming}>Cancel</Button>
            <Button onClick={handleRenamePod} disabled={renaming || !renameValue.trim()}>
              {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {skillBattlePicker}
    </main>
  );
};

export default PrivateLeagueDetail;
