import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { roundLabels, weekLabel, type GameWeek, type Participant } from "@/lib/tournament";
import { cn } from "@/lib/utils";

const db = supabase as any;

function seasonName(id: string) {
  const [y, m] = id.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Current monthly season standings, last week's champion, and past season champions for a pod. */
export default function PodSeasonStandings({ podId }: { podId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [season, setSeason] = useState<string | null>(null);
  const [past, setPast] = useState<{ season: string; userId: string; points: number }[]>([]);
  const [lastChamp, setLastChamp] = useState<{ p: Participant; week: GameWeek; size: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: all } = await db.from("pod_season_standings").select("season_id, user_id, points, best_finish, championships").eq("pod_id", podId);
      const list = (all ?? []) as any[];
      const seasons = [...new Set(list.map((r) => r.season_id))].sort().reverse();
      const now = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }).slice(0, 7);
      const cur = seasons.includes(now) ? now : seasons[0] ?? now;
      setSeason(cur);
      setRows(list.filter((r) => r.season_id === cur).sort((a, b) => b.points - a.points));
      setPast(seasons.filter((s) => s !== cur || cur !== now).filter((s) => s < now).map((s) => {
        const top = list.filter((r) => r.season_id === s).sort((a, b) => b.points - a.points)[0];
        return { season: s, userId: top.user_id, points: top.points };
      }));
      const ids = [...new Set(list.map((r) => r.user_id))];
      if (ids.length) {
        const { data: profs } = await db.from("profiles").select("id, display_name").in("id", ids);
        setNames(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.display_name ?? "Player"])));
      }
      const { data: b } = await db.from("brackets").select("participants, champion_participant_id, size, game_weeks!inner(*)")
        .eq("pod_id", podId).eq("game_weeks.status", "published").eq("game_weeks.is_test", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (b) {
        const p = (b.participants as Participant[]).find((x) => x.id === b.champion_participant_id);
        if (p) setLastChamp({ p, week: b.game_weeks, size: b.size });
      }
      setLoading(false);
    })();
  }, [podId]);

  const finishLabel = (rounds: number | null) => {
    if (!rounds) return "—";
    if (!lastChamp) return `${rounds} win${rounds === 1 ? "" : "s"}`;
    const labels = roundLabels(lastChamp.size);
    return rounds >= labels.length ? "Champion" : labels[rounds] ?? `${rounds} wins`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><Trophy className="h-5 w-5 text-primary" />
          Season standings {season && <span className="text-sm font-normal text-muted-foreground">· {seasonName(season)}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastChamp && (
          <Link to={`/week/${lastChamp.week.id}`} className="flex items-center gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3">
            {lastChamp.p.image_url ? <img src={lastChamp.p.image_url} alt="" className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-muted grid place-items-center">🕷️</div>}
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">{weekLabel(lastChamp.week)} champion</div>
              <div className="font-bold truncate">{lastChamp.p.name}</div>
              <div className="text-xs text-muted-foreground truncate">{lastChamp.p.is_wild ? "Wild Challenger" : lastChamp.p.owner_name}</div>
            </div>
          </Link>
        )}

        {loading ? <div className="h-24 animate-pulse rounded bg-muted" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No points yet this season. Every match your spiders win is 1 point; owning the pod champion is +3.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-[2rem_1fr_3.5rem_5.5rem] gap-2 bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>#</span><span>Manager</span><span className="text-right">Pts</span><span className="text-right">Best</span>
            </div>
            {rows.map((r, i) => (
              <div key={r.user_id} className={cn("grid grid-cols-[2rem_1fr_3.5rem_5.5rem] gap-2 border-t border-border px-3 py-2.5 text-sm", r.user_id === user?.id && "bg-primary/10")}>
                <span className="font-bold tabular-nums">{i + 1}</span>
                <span className="truncate">{names[r.user_id] ?? "Player"}{r.championships ? ` ${"🏆".repeat(Math.min(3, r.championships))}` : ""}</span>
                <span className="text-right font-bold tabular-nums">{r.points}</span>
                <span className="text-right text-xs text-muted-foreground">{finishLabel(r.best_finish)}</span>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Past season champions</div>
            <div className="space-y-1.5">
              {past.map((p) => (
                <div key={p.season} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-300" />{names[p.userId] ?? "Player"}</span>
                  <span className="text-muted-foreground">{seasonName(p.season)} · {p.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
