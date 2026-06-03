import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Loader2, Sword, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PodThumbnail from "@/components/PodThumbnail";

interface ActivePod {
  league_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  member_count: number;
  battle_count: number;
}

const ActivePodsLeaderboard = () => {
  const [pods, setPods] = useState<ActivePod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_most_active_pods", { limit_count: 5 });
      if (cancelled) return;
      if (!error && data) {
        setPods(
          (data as any[]).map((row) => ({
            league_id: row.league_id,
            name: row.name,
            slug: row.slug,
            image_url: row.image_url,
            member_count: Number(row.member_count ?? 0),
            battle_count: Number(row.battle_count ?? 0),
          })),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="overflow-hidden border-primary/20 bg-card/70">
      <CardContent className="space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Flame className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Most active pods</span>
          </div>
          <span className="text-xs text-muted-foreground">Battles · last 7 days</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pods.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No pod battles yet this week. Start one to take the top spot!
          </p>
        ) : (
          <ol className="space-y-2">
            {pods.map((pod, idx) => {
              const rank = idx + 1;
              return (
                <li key={pod.league_id}>
                  <Link
                    to={`/leagues/${pod.league_id}`}
                    className="group flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex w-7 items-center justify-center">
                      {rank === 1 ? (
                        <Trophy className="h-5 w-5 text-amber-500" />
                      ) : rank === 2 ? (
                        <Trophy className="h-5 w-5 text-gray-400" />
                      ) : rank === 3 ? (
                        <Trophy className="h-5 w-5 text-amber-600" />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
                      )}
                    </div>
                    <PodThumbnail imageUrl={pod.image_url} podName={pod.name} className="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold group-hover:text-primary">
                        {pod.name}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {pod.member_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Sword className="h-3 w-3" /> {pod.battle_count}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivePodsLeaderboard;