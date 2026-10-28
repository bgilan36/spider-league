import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Crown, RefreshCw, Trophy } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SpiderLogoLoader from "@/components/SpiderLogoLoader";
import { TOURNAMENT, weekLabel, type Bracket, type GameWeek } from "@/lib/tournament";
import { cn } from "@/lib/utils";

const db = supabase as any;
interface Standing { season_id: string; user_id: string; points: number; championships: number; best_finish: number | null }
interface HistoryRow extends Bracket { game_weeks: GameWeek }
interface Profile { id: string; display_name: string | null; avatar_url: string | null }

function seasonName(id: string) {
  const [year, month] = id.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function PodStandings() {
  const { podId = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [selectedSeason, setSelectedSeason] = useState("");
  const [historyLimit, setHistoryLimit] = useState(24);
  const access = useQuery({
    queryKey: ["pod-standings-access", podId, user?.id],
    enabled: !!user && !!podId,
    queryFn: async () => {
      const { data, error } = await db.from("private_league_members").select("id")
        .eq("league_id", podId).eq("user_id", user?.id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const pod = await db.from("private_leagues").select("id,name").eq("id", podId).maybeSingle();
      if (pod.error) throw pod.error;
      return pod.data as { id: string; name: string } | null;
    },
  });
  const standings = useQuery({
    queryKey: ["pod-season-history", podId, user?.id],
    enabled: !!access.data,
    queryFn: async () => {
      const result = await db.from("pod_season_standings").select("season_id,user_id,points,championships,best_finish").eq("pod_id", podId);
      if (result.error) throw result.error;
      const rows = (result.data ?? []) as Standing[];
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const profiles = ids.length ? await db.from("profiles").select("id,display_name,avatar_url").in("id", ids).eq("is_demo", false) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const names = new Map<string, Profile>((profiles.data as Profile[]).map((p) => [p.id, p]));
      return { rows: rows.filter((r) => names.has(r.user_id)), names };
    },
  });
  const history = useQuery({
    queryKey: ["pod-champion-history", podId, user?.id, historyLimit],
    enabled: !!access.data,
    queryFn: async () => {
      const result = await db.from("brackets").select("*,game_weeks!inner(*)")
        .eq("pod_id", podId).eq("type", "pod").eq("game_weeks.status", "published")
        .eq("game_weeks.is_test", false).order("week_id", { ascending: false }).range(0, historyLimit);
      if (result.error) throw result.error;
      return { rows: (result.data ?? []).slice(0, historyLimit) as HistoryRow[], more: (result.data ?? []).length > historyLimit };
    },
  });

  const nowParts = new Intl.DateTimeFormat("en-US", { timeZone: TOURNAMENT.TIMEZONE, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const currentSeason = `${nowParts.find((p) => p.type === "year")?.value}-${nowParts.find((p) => p.type === "month")?.value}`;
  const allRows = standings.data?.rows ?? [];
  const seasons = [...new Set([currentSeason, ...allRows.map((r) => r.season_id)])].sort().reverse();
  const season = seasons.includes(selectedSeason) ? selectedSeason : currentSeason;
  const rows = allRows.filter((r) => r.season_id === season).sort((a, b) => b.points - a.points);
  const pastSeasons = seasons.filter((s) => s < currentSeason).map((s) => {
    const ranked = allRows.filter((r) => r.season_id === s).sort((a, b) => b.points - a.points);
    return { season: s, winners: ranked.filter((r) => r.points === ranked[0]?.points) };
  });
  const retry = () => { void access.refetch(); void standings.refetch(); void history.refetch(); };
  const error = access.error || standings.error || history.error;

  if (authLoading || (user && access.isPending)) return <main className="grid min-h-[60vh] place-items-center"><SpiderLogoLoader /></main>;
  if (!user || (!access.data && !access.error)) return (
    <main className="container mx-auto max-w-xl space-y-4 px-4 py-12 text-center">
      <h1 className="text-2xl font-bold">Pod standings</h1>
      <p className="text-muted-foreground">{user ? "This page is for members of this pod." : "Sign in to see your pod’s standings and champions."}</p>
      <Button asChild><Link to={user ? "/pods" : "/auth"}>{user ? "Back to pods" : "Sign in"}</Link></Button>
    </main>
  );

  return (
    <main className="container mx-auto max-w-4xl space-y-8 px-4 py-6">
      <Helmet><title>{access.data?.name ?? "Pod"} Standings & Champions — Spider League</title><meta name="description" content="Season standings and past tournament champions for your Spider League pod." /></Helmet>
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm"><Link to={`/leagues/${podId}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to pod</Link></Button>
        <p className="font-semibold text-primary break-words">{access.data?.name}</p>
        <h1 className="text-3xl font-black">Standings & champions</h1>
      </header>
      {error ? <div role="alert" className="space-y-3 border-l-2 border-destructive pl-4"><p>Couldn’t load pod standings. Please try again.</p><Button variant="outline" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div> : <>
        <section className="space-y-4" aria-labelledby="season-standings">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="season-standings" className="flex items-center gap-2 text-xl font-bold"><Trophy className="h-5 w-5 text-primary" />Season standings</h2>
            <Select value={season} onValueChange={setSelectedSeason}><SelectTrigger aria-label="Season" className="w-[210px]"><SelectValue /></SelectTrigger><SelectContent>{seasons.map((s) => <SelectItem key={s} value={s}>{seasonName(s)}</SelectItem>)}</SelectContent></Select>
          </div>
          {standings.isPending ? <div className="h-32 animate-pulse rounded-md bg-muted" /> : rows.length === 0 ? <div className="space-y-3 border-y border-border py-6"><p className="text-muted-foreground">No points yet for {seasonName(season)}.</p><Button asChild variant="outline"><Link to="/upload"><Camera className="mr-2 h-4 w-4" />Catch a contender</Link></Button></div> :
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y border-border text-left text-xs text-muted-foreground"><tr><th className="py-3 pr-2">Rank</th><th className="py-3">Player</th><th className="px-2 py-3 text-right">Points</th><th className="py-3 text-right">Titles</th></tr></thead><tbody>{rows.map((r, i) => {
              const profile = standings.data?.names.get(r.user_id);
              const rank = rows.findIndex((x) => x.points === r.points) + 1;
              return <tr key={r.user_id} className={cn("border-b border-border", r.user_id === user.id && "bg-primary/10")}><td className="py-4 pr-2 font-bold tabular-nums">{rank === 1 ? <Crown className="h-5 w-5 text-rarity-legendary" aria-label="First place" /> : rank}</td><td className="py-4"><span className="flex items-center gap-2">{profile?.avatar_url && <img src={profile.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />}<span className="break-words">{profile?.display_name ?? "Player"}{r.user_id === user.id && <span className="ml-1 text-xs text-primary">(you)</span>}</span></span></td><td className="px-2 py-4 text-right font-bold tabular-nums">{r.points}</td><td className="py-4 text-right tabular-nums">{r.championships}</td></tr>;
            })}</tbody></table></div>}
        </section>
        {pastSeasons.length > 0 && <section className="space-y-3"><h2 className="text-xl font-bold">Past season champions</h2><div className="divide-y divide-border">{pastSeasons.map((s) => <div key={s.season} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="text-xs text-muted-foreground">{seasonName(s.season)}</p><p className="font-semibold">{s.winners.map((r) => standings.data?.names.get(r.user_id)?.display_name ?? "Player").join(" & ")}</p></div><Button variant="ghost" onClick={() => setSelectedSeason(s.season)}>{s.winners[0]?.points ?? 0} pts · Standings</Button></div>)}</div></section>}
        <section className="space-y-4" aria-labelledby="pod-champions">
          <h2 id="pod-champions" className="flex items-center gap-2 text-xl font-bold"><Crown className="h-5 w-5 text-rarity-legendary" />Hall of Champions</h2>
          {history.isPending ? <div className="h-48 animate-pulse rounded-md bg-muted" /> : !history.data?.rows.some((b) => b.champion_participant_id) ? <p className="border-y border-border py-6 text-muted-foreground">No champions crowned yet. Your pod’s first tournament winner will appear here.</p> :
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{history.data?.rows.map((b) => {
              const champ = b.participants.find((p) => p.id === b.champion_participant_id);
              if (!champ) return null;
              return <Link key={b.id} to={`/pods/${podId}/week/${b.week_id}`} className="group min-w-0 overflow-hidden rounded-lg border border-rarity-legendary/30 bg-card transition-colors hover:border-rarity-legendary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {champ.image_url ? <img src={champ.image_url} alt={champ.name} loading="lazy" className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center bg-muted"><Crown className="h-12 w-12 text-rarity-legendary" /></div>}
                <div className="space-y-1 p-3"><p className="text-xs font-semibold text-rarity-legendary">{weekLabel(b.game_weeks)}</p><h3 className="break-words font-bold">{champ.name}</h3><p className="break-words text-xs text-muted-foreground">{champ.species}</p><p className="break-words text-xs text-muted-foreground">{champ.owner_name ?? "Pod champion"}</p><p className="text-xs font-semibold text-primary">{champ.power} power · Results →</p></div>
              </Link>;
            })}</div>}
          {history.data?.more && <Button variant="outline" onClick={() => setHistoryLimit((n) => n + 24)}>Older champions</Button>}
        </section>
      </>}
    </main>
  );
}