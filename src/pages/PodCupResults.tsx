import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Camera, Flame, Swords, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import BracketView from "@/components/week/BracketView";
import ChampionReveal from "@/components/week/ChampionReveal";
import PodSeasonStandings from "@/components/week/PodSeasonStandings";
import SpiderLogoLoader from "@/components/SpiderLogoLoader";
import { roundLabels, weekLabel, type Bracket, type GameWeek, type Match } from "@/lib/tournament";

const db = supabase as any;

/** Results page for one pod's weekly tournament (members only, enforced by data access). */
export default function PodCupResults() {
  const { podId = "", weekId = "" } = useParams();
  const { user } = useAuth();
  const [week, setWeek] = useState<GameWeek | null>(null);
  const [podName, setPodName] = useState("Pod");
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: w }, { data: p }, { data: b }] = await Promise.all([
        db.from("game_weeks").select("*").eq("id", weekId).maybeSingle(),
        db.from("private_leagues").select("name").eq("id", podId).maybeSingle(),
        db.from("brackets").select("*").eq("week_id", weekId).eq("type", "pod").eq("pod_id", podId).maybeSingle(),
      ]);
      setWeek(w); setBracket(b); if (p?.name) setPodName(p.name);
      if (b) setMatches((await db.from("matches").select("*").eq("bracket_id", b.id)).data ?? []);
      setLoading(false);
    })();
  }, [podId, weekId]);

  const label = weekLabel(week);
  const champ = bracket?.participants.find((x) => x.id === bracket.champion_participant_id);
  const rounds = bracket ? roundLabels(bracket.size) : [];

  const stats = useMemo(() => {
    if (!bracket) return [];
    return bracket.participants.map((p) => {
      const mine = matches.filter((m) => m.winner_id && (m.spider_a_id === p.id || m.spider_b_id === p.id));
      const wins = mine.filter((m) => m.winner_id === p.id).length;
      const lastRound = mine.reduce((r, m) => Math.max(r, m.round_number), 0);
      let duelsWon = 0, duels = 0;
      for (const m of mine) for (const r of m.rounds ?? []) {
        duels++;
        if ((r.winner === "a") === (m.spider_a_id === p.id)) duelsWon++;
      }
      const finish = p.id === bracket.champion_participant_id ? "Champion"
        : lastRound ? (rounds[lastRound - 1] ?? `Round ${lastRound}`) : "Bye";
      return { p, wins, losses: mine.length - wins, duelsWon, duels, finish, depth: p.id === bracket.champion_participant_id ? 99 : lastRound };
    }).sort((a, b) => b.depth - a.depth || b.wins - a.wins || b.p.power - a.p.power);
  }, [bracket, matches, rounds]);

  const upset = bracket?.upset_match_id ? matches.find((m) => m.id === bracket.upset_match_id) : null;
  const byId = (id?: string | null) => bracket?.participants.find((x) => x.id === id);

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><SpiderLogoLoader /></div>;

  if (!week || week.status !== "published" || !bracket || !champ) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-12 text-center space-y-3">
        <h1 className="text-2xl font-bold">{podName} · {label || "Pod tournament"}</h1>
        <p className="text-muted-foreground">
          {week && week.status !== "published"
            ? "Results aren't out yet — brackets are revealed Sunday night after entries lock."
            : !user
              ? "Sign in as a pod member to see this tournament."
              : "This pod didn't hold a tournament this week — pods need at least two entered spiders, or you're not a member."}
        </p>
        <Button asChild><Link to={user ? `/leagues/${podId}` : "/auth"}>{user ? "Back to pod" : "Sign in"}</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-3 py-4 sm:py-6 space-y-5">
      <Helmet><title>{`${podName} · ${label} — Spider League`}</title></Helmet>
      <Button variant="ghost" size="sm" asChild><Link to={`/leagues/${podId}`}><ArrowLeft className="h-4 w-4 mr-1" />{podName}</Link></Button>
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Pod tournament</div>
        <h1 className="text-3xl font-black">{podName} · {label}</h1>
      </div>

      <ChampionReveal champion={champ} title={`${podName} Champion · ${label}`} recap={bracket.final_recap} />

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Users} label="Spiders" value={bracket.participants.length} />
        <Stat icon={Swords} label="Matches" value={matches.filter((m) => m.winner_id && m.spider_a_id && m.spider_b_id).length} />
        <Stat icon={Trophy} label="Bracket" value={bracket.size} />
      </div>

      {upset && byId(upset.winner_id) && (
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-primary"><Flame className="h-4 w-4" />Upset of the week</div>
          <p className="text-sm">
            <b>{byId(upset.winner_id)!.name}</b> knocked out{" "}
            <b>{byId(upset.winner_id === upset.spider_a_id ? upset.spider_b_id : upset.spider_a_id)?.name}</b>
            {" "}in the {rounds[upset.round_number - 1] ?? `round ${upset.round_number}`}.
          </p>
          {upset.commentary && <p className="text-sm text-muted-foreground italic">{upset.commentary}</p>}
        </div>
      )}

      <h2 className="text-lg font-bold">The bracket</h2>
      <BracketView bracket={bracket} matches={matches} myUserId={user?.id} playback={false} />

      <h2 className="text-lg font-bold">Spider stats</h2>
      <div className="rounded-xl border bg-card divide-y">
        {stats.map(({ p, wins, losses, duelsWon, duels, finish }) => (
          <div key={p.id} className={`flex items-center gap-3 p-3 ${p.owner_id === user?.id ? "bg-primary/5" : ""}`}>
            {p.image_url ? <img src={p.image_url} alt={p.name} className="h-11 w-11 rounded-lg object-cover shrink-0" /> : <div className="h-11 w-11 rounded-lg bg-muted shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{p.seed ? <span className="text-muted-foreground mr-1">#{p.seed}</span> : null}{p.name}</div>
              <div className="text-xs text-muted-foreground truncate">{p.species}{p.owner_name ? ` · ${p.owner_name}` : ""}{p.is_veteran ? " · Veteran" : ""}</div>
            </div>
            <div className="text-right text-xs shrink-0">
              <div className={`font-bold ${finish === "Champion" ? "text-primary" : ""}`}>{finish}</div>
              <div className="text-muted-foreground">{wins}–{losses} · {duelsWon}/{duels} duels · {p.power} pwr</div>
            </div>
          </div>
        ))}
      </div>

      <PodSeasonStandings podId={podId} />

      <Button asChild variant="outline" className="w-full"><Link to="/upload"><Camera className="mr-2 h-4 w-4" />Catch a contender for next week</Link></Button>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <Icon className="h-4 w-4 mx-auto text-primary" />
      <div className="text-xl font-black">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
