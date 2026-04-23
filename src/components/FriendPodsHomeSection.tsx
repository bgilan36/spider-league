import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import CreatePrivateLeagueButton from "@/components/CreatePrivateLeagueButton";

interface PodSummary {
  id: string;
  name: string;
  member_count: number;
}

const FriendPodsHomeSection = () => {
  const { user } = useAuth();
  const [pods, setPods] = useState<PodSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: memberships } = await (supabase as any)
        .from("private_league_members")
        .select("league_id, private_leagues!inner(id, name, is_active)")
        .eq("user_id", user.id);
      if (cancelled) return;
      const activeLeagues = (memberships || [])
        .filter((m: any) => m.private_leagues?.is_active)
        .map((m: any) => ({ id: m.private_leagues.id, name: m.private_leagues.name }));

      if (activeLeagues.length === 0) {
        setPods([]);
        setLoading(false);
        return;
      }

      const { data: counts } = await (supabase as any)
        .from("private_league_members")
        .select("league_id")
        .in(
          "league_id",
          activeLeagues.map((l: any) => l.id),
        );

      const countMap = new Map<string, number>();
      (counts || []).forEach((row: any) => {
        countMap.set(row.league_id, (countMap.get(row.league_id) || 0) + 1);
      });

      setPods(
        activeLeagues.map((l: any) => ({
          id: l.id,
          name: l.name,
          member_count: countMap.get(l.id) || 1,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <Card className="overflow-hidden border-primary/20 bg-card/70">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (pods.length === 0) {
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
          <div className="flex flex-col gap-2 sm:min-w-56">
            <CreatePrivateLeagueButton size="lg" className="w-full" />
            <Button asChild variant="outline" className="w-full">
              <Link to="/leagues">View your pods</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/20 bg-card/70">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Your friend pods</span>
            </div>
            <p className="text-sm text-muted-foreground">Jump straight into a pod to battle and check standings.</p>
          </div>
          <CreatePrivateLeagueButton size="sm" />
        </div>

        <ul className="space-y-2">
          {pods.map((pod) => (
            <li key={pod.id}>
              <Link
                to={`/leagues/${pod.id}`}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3 transition hover:border-primary/60 hover:bg-primary/5"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{pod.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {pod.member_count} {pod.member_count === 1 ? "member" : "members"}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link to="/leagues">View all pods</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FriendPodsHomeSection;