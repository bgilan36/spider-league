import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Crown, Loader2, Sparkles, Swords, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

const PENDING_INVITE_KEY = "pendingPrivateLeagueInvite";

const JoinLeague = () => {
  const { inviteToken } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const loadPreview = async () => {
      if (!inviteToken) return;
      setLoading(true);
      const { data } = await (supabase as any).rpc("get_private_league_invite_preview", { token: inviteToken });
      setPreview(data);
      setLoading(false);
    };
    loadPreview();
  }, [inviteToken]);

  const joinLeague = async () => {
    if (!inviteToken) return;
    if (!user) {
      sessionStorage.setItem(PENDING_INVITE_KEY, inviteToken);
      navigate("/auth");
      return;
    }

    setClaiming(true);
    const { data, error } = await (supabase as any).rpc("claim_private_league_invite", { token: inviteToken });
    setClaiming(false);
    if (error || data?.success === false) {
      toast({ title: "Could not join pod", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "You joined the league", description: data?.league_name });
    navigate(`/leagues/${data.league_id}`);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <Helmet><title>Join Spider League Pod</title><meta name="description" content="Preview and join a private Spider League pod." /></Helmet>
      <div className="mx-auto max-w-2xl">
        {loading || authLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : !preview?.valid ? (
          <Card><CardContent className="py-12 text-center"><Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><h1 className="mb-2 text-2xl font-bold">Invite unavailable</h1><p className="mb-4 text-muted-foreground">{preview?.error || "This pod invite is no longer active."}</p><Button asChild><Link to="/">Go home</Link></Button></CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="text-center">
              <Badge className="mx-auto mb-3 w-fit">Private pod invite</Badge>
              <CardTitle className="text-3xl">{preview.league_name}</CardTitle>
              <p className="text-muted-foreground">Created by {preview.creator_name}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border p-4 text-center">
                  <Users className="mx-auto mb-2 h-6 w-6 text-primary" />
                  <div className="text-2xl font-bold">{preview.member_count}</div>
                  <div className="text-sm text-muted-foreground">member{preview.member_count === 1 ? "" : "s"}</div>
                </div>
                <div className="rounded-md border border-border p-4 text-center">
                  <Swords className="mx-auto mb-2 h-6 w-6 text-primary" />
                  <div className="text-2xl font-bold">{preview.battle_count ?? 0}</div>
                  <div className="text-sm text-muted-foreground">pod battle{preview.battle_count === 1 ? "" : "s"}</div>
                </div>
                <div className="rounded-md border border-border p-4 text-center">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
                  <div className="text-2xl font-bold">Private</div>
                  <div className="text-sm text-muted-foreground">friends only</div>
                </div>
              </div>

              {preview.members?.length > 0 && (
                <div className="space-y-3">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <Users className="h-4 w-4 text-primary" />
                    Who's in the pod
                  </h2>
                  <div className="space-y-2">
                    {preview.members.map((member: any) => {
                      const top = member.top_spider && Object.keys(member.top_spider).length > 0 ? member.top_spider : null;
                      return (
                        <div key={member.user_id} className="flex items-center gap-3 rounded-md border border-border p-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-semibold">{(member.display_name || "P").charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 truncate font-medium">
                              {member.display_name}
                              {member.is_owner && <Crown className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {top ? `Top spider: ${top.nickname} · ${top.power_score} PWR` : "No active spider yet"}
                            </div>
                          </div>
                          {top?.image_url && (
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                              <img src={top.image_url} alt={top.nickname} className="h-full w-full object-cover" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {preview.recent_activity?.length > 0 && (
                <div className="space-y-2">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <Trophy className="h-4 w-4 text-primary" />
                    Recent pod battles
                  </h2>
                  {preview.recent_activity.map((item: any) => (
                    <div key={item.id} className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                      {item.spider_a || "A spider"} vs {item.spider_b || "another spider"}
                    </div>
                  ))}
                </div>
              )}

              <Button className="w-full" size="lg" onClick={joinLeague} disabled={claiming}>
                {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Join this league
              </Button>
              <p className="text-center text-xs text-muted-foreground">No account needed to preview. Sign-in only happens when you join.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};

export default JoinLeague;
export { PENDING_INVITE_KEY };
