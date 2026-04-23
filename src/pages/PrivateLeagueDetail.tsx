import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import PrivateLeagueInvitePanel from "@/components/PrivateLeagueInvitePanel";
import PrivateLeagueStandings from "@/components/PrivateLeagueStandings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PrivateLeagueDetail = () => {
  const { leagueId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [league, setLeague] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invite, setInvite] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [battleLoading, setBattleLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mySpiders, setMySpiders] = useState<any[]>([]);
  const [opponentSpiders, setOpponentSpiders] = useState<any[]>([]);
  const [selectedMySpiderId, setSelectedMySpiderId] = useState<string>("");
  const [selectedOpponentSpiderId, setSelectedOpponentSpiderId] = useState<string>("");
  const [pickerLoading, setPickerLoading] = useState(false);

  const inviteUrl = useMemo(() => invite?.token ? `${window.location.origin}/join/${invite.token}` : "", [invite]);

  const fetchLeague = useCallback(async () => {
    if (!leagueId || !user) return;
    setLoading(true);
    const [{ data: leagueData }, { data: memberData }, { data: inviteData }, { data: standingData }] = await Promise.all([
      (supabase as any).from("private_leagues").select("*").eq("id", leagueId).maybeSingle(),
      (supabase as any).from("private_league_members").select("user_id,role,joined_at,profiles(display_name,avatar_url)").eq("league_id", leagueId).order("joined_at"),
      (supabase as any).from("private_league_invites").select("token").eq("league_id", leagueId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).rpc("get_private_league_standings", { league_id: leagueId }),
    ]);
    setLeague(leagueData);
    setMembers(memberData || []);
    setInvite(inviteData);
    setStandings(standingData || []);
    setLoading(false);
  }, [leagueId, user]);

  useEffect(() => { fetchLeague(); }, [fetchLeague]);

  const openPicker = async () => {
    if (!leagueId || !user) return;
    setPickerOpen(true);
    setPickerLoading(true);
    const now = new Date().toISOString();
    const opponentIds = members.map((m) => m.user_id).filter((id) => id !== user.id);
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
    setPickerLoading(false);
  };

  const startPodBattle = async () => {
    if (!leagueId || !selectedMySpiderId || !selectedOpponentSpiderId) return;
    setBattleLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("quick-battle", {
        body: {
          leagueId,
          spiderId: selectedMySpiderId,
          opponentSpiderId: selectedOpponentSpiderId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Pod battle complete", description: "Opening the replay." });
      navigate(`/battle/${data.battleId}`);
    } catch (error: any) {
      toast({ title: "Can't start pod battle", description: error.message, variant: "destructive" });
    } finally {
      setBattleLoading(false);
      setPickerOpen(false);
    }
  };

  if (loading) return <main className="container mx-auto px-4 py-10"><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div></main>;
  if (!league) return <main className="container mx-auto px-4 py-10"><Card><CardContent className="py-10 text-center"><h1 className="mb-2 text-2xl font-bold">Pod not found</h1><Button asChild><Link to="/leagues">Back to pods</Link></Button></CardContent></Card></main>;

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet><title>{league.name} — Spider League Pod</title><meta name="description" content="Private Spider League pod standings and battles." /></Helmet>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><Button asChild variant="ghost" size="sm" className="mb-2"><Link to="/leagues"><ArrowLeft className="h-4 w-4" />Pods</Link></Button><h1 className="text-3xl font-bold">{league.name}</h1><p className="text-muted-foreground">Beat your friends inside this pod.</p></div>
        <Button onClick={openPicker} disabled={battleLoading || members.length < 2} size="lg">{battleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}Battle a pod member</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <PrivateLeagueStandings standings={standings} />
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-primary" />Members</CardTitle></CardHeader><CardContent className="space-y-2">{members.map((member) => <div key={member.user_id} className="flex items-center gap-3 rounded-md border border-border p-3"><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted">{member.profiles?.avatar_url ? <img src={member.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : <span>{(member.profiles?.display_name || "P").charAt(0)}</span>}</div><div className="flex-1"><div className="font-medium">{member.profiles?.display_name || `Player ${member.user_id.slice(0, 6)}`}</div><div className="text-xs text-muted-foreground">{member.role}</div></div></div>)}</CardContent></Card>
        </div>
        {inviteUrl && <PrivateLeagueInvitePanel inviteUrl={inviteUrl} memberCount={members.length} />}
      </div>

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
            <Button onClick={startPodBattle} disabled={battleLoading || pickerLoading || !selectedMySpiderId || !selectedOpponentSpiderId}>
              {battleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              Start battle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default PrivateLeagueDetail;
