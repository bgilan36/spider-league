import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Camera, Globe, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import BracketView from "@/components/week/BracketView";
import LiveBracketPreview from "@/components/week/LiveBracketPreview";
import PodBracketPreviews from "@/components/week/PodBracketPreviews";
import ChampionReveal from "@/components/week/ChampionReveal";
import SpiderLogoLoader from "@/components/SpiderLogoLoader";
import { ensureCupCard } from "@/lib/cupShareImage";
import { cupShareUrl, logEvent, weekLabel, type Bracket, type GameWeek, type Match } from "@/lib/tournament";

const db = supabase as any;

export default function WeekResults() {
  const { weekId = "" } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [week, setWeek] = useState<GameWeek | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [podNames, setPodNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("");
  const [podIdx, setPodIdx] = useState(0);
  const [finished, setFinished] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: w } = await db.from("game_weeks").select("*").eq("id", weekId).maybeSingle();
      setWeek(w);
      const { data: bs } = await db.from("brackets").select("*").eq("week_id", weekId);
      const all = (bs ?? []) as Bracket[];
      let mine: string[] = [];
      if (user) {
        const { data: mem } = await db.from("private_league_members").select("league_id").eq("user_id", user.id);
        mine = (mem ?? []).map((m: any) => m.league_id);
      }
      const visible = all.filter((b) => b.type === "global" || mine.includes(b.pod_id!));
      setBrackets(visible);
      const ids = visible.map((b) => b.id);
      if (ids.length) {
        const { data: ms } = await db.from("matches").select("*").in("bracket_id", ids);
        setMatches(ms ?? []);
        const podIds = visible.filter((b) => b.pod_id).map((b) => b.pod_id);
        if (podIds.length) {
          const { data: names } = await db.from("private_leagues").select("id, name").in("id", podIds);
          setPodNames(Object.fromEntries((names ?? []).map((n: any) => [n.id, n.name])));
        }
      }
      const hasPods = visible.some((b) => b.type === "pod");
      setTab(params.get("tab") === "global" || !hasPods ? "global" : "pods");
      setLoading(false);
      logEvent("results_viewed", { reached_champion: false }, weekId);
      if (user && w) await db.from("result_views").upsert({ user_id: user.id, week_id: weekId }, { onConflict: "user_id,week_id", ignoreDuplicates: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId, user?.id]);

  const global = brackets.find((b) => b.type === "global");
  const pods = brackets.filter((b) => b.type === "pod");
  const pod = pods[podIdx];
  const mFor = useCallback((b?: Bracket) => (b ? matches.filter((m) => m.bracket_id === b.id) : []), [matches]);

  const onGlobalFinished = useCallback(async () => {
    setFinished((f) => ({ ...f, global: true }));
    logEvent("results_viewed", { reached_champion: true }, weekId);
    if (user) await db.from("result_views").upsert({ user_id: user.id, week_id: weekId, reached_champion: true, updated_at: new Date().toISOString() }, { onConflict: "user_id,week_id" });
  }, [user, weekId]);

  const share = async () => {
    const url = cupShareUrl(weekId);
    logEvent("share_clicked", { surface: "results" }, weekId);
    if (user && gChamp && week && !week.is_test) await ensureCupCard(weekId, { name: gChamp.name, species: gChamp.species, imageUrl: gChamp.image_url, weekLabel: weekLabel(week), owner: gChamp.owner_name });
    const text = `The ${weekLabel(week)} Global Cup champion has been crowned 🕷️`;
    try {
      if (navigator.share) await navigator.share({ title: "Spider League Global Cup", text, url });
      else { await navigator.clipboard.writeText(url); toast({ title: "Link copied" }); }
    } catch { /* cancelled */ }
  };

  const champ = (b?: Bracket) => b?.participants.find((p) => p.id === b.champion_participant_id);
  const label = weekLabel(week);
  const gChamp = useMemo(() => champ(global), [global]);

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><SpiderLogoLoader /></div>;

  if (week?.status === "open") {
    return (
      <div className="container mx-auto max-w-3xl px-3 py-6 space-y-4">
        <Helmet><title>{label} bracket preview — Spider League</title></Helmet>
        <Button variant="ghost" asChild><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Home</Link></Button>
        <h1 className="text-2xl font-black">{label} · Global Cup</h1>
        <LiveBracketPreview weekId={weekId} myUserId={user?.id} />
        <PodBracketPreviews weekId={weekId} myUserId={user?.id} />
      </div>
    );
  }

  if (!week || week.status !== "published") {
    return (
      <div className="container mx-auto px-4 py-10 text-center space-y-3">
        <h1 className="text-2xl font-bold">Results aren't out yet</h1>
        <p className="text-muted-foreground">Brackets are revealed Sunday night after entries lock.</p>
        <Button asChild><Link to="/">Back to This Week</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-3 py-4 sm:py-6 space-y-4">
      <Helmet><title>{label} results — Spider League</title></Helmet>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Home</Link></Button>
        <Button variant="outline" size="sm" className="ml-auto" onClick={share}><Share2 className="h-4 w-4 mr-1" />Share</Button>
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Results reveal</div>
        <h1 className="text-3xl font-black">{label}</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="pods" className="h-10"><Users className="h-4 w-4 mr-1.5" />My Pods</TabsTrigger>
          <TabsTrigger value="global" className="h-10"><Globe className="h-4 w-4 mr-1.5" />Global Cup</TabsTrigger>
        </TabsList>

        <TabsContent value="pods" className="space-y-4 pt-2">
          {pods.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">None of your pods had a tournament this week. Pods need at least two entered spiders.</p>
              <Button asChild variant="outline"><Link to="/pods">Go to pods</Link></Button>
            </div>
          ) : (
            <>
              {pods.length > 1 && (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {pods.map((p, i) => (
                    <Button key={p.id} size="sm" variant={i === podIdx ? "default" : "outline"} onClick={() => setPodIdx(i)} className="shrink-0">
                      {podNames[p.pod_id!] ?? "Pod"}
                    </Button>
                  ))}
                </div>
              )}
              {pod && (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{podNames[pod.pod_id!] ?? "Pod"} bracket</h2>
                    <Button asChild size="sm" variant="outline" className="ml-auto"><Link to={`/pods/${pod.pod_id}/week/${weekId}`}>Full results & stats</Link></Button>
                  </div>
                  <BracketView key={pod.id} bracket={pod} matches={mFor(pod)} myUserId={user?.id} onFinished={() => setFinished((f) => ({ ...f, [pod.id]: true }))} />
                  {finished[pod.id] && champ(pod) && (
                    <ChampionReveal champion={champ(pod)!} title={`${podNames[pod.pod_id!] ?? "Pod"} champion`} recap={pod.final_recap} />
                  )}
                  {finished[pod.id] && global && (
                    <Button className="w-full h-12 text-base font-bold" onClick={() => setTab("global")}>
                      <Globe className="mr-2 h-5 w-5" /> Now the Global Cup →
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="global" className="space-y-4 pt-2">
          {!global ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
              <Globe className="h-10 w-10 mx-auto text-muted-foreground" />
              <h2 className="text-lg font-black">No Global Cup this week</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {week.no_cup_reason ?? "The Global Cup needs at least two real spiders entered — not enough were entered this week."}
              </p>
              <Button asChild size="lg" className="w-full max-w-xs mx-auto font-bold">
                <Link to="/upload"><Camera className="mr-2 h-5 w-5" />Catch a contender for next week</Link>
              </Button>
            </div>
          ) : (
            <>
              <BracketView key={global.id} bracket={global} matches={mFor(global)} myUserId={user?.id} onFinished={onGlobalFinished} />
              {finished.global && gChamp && (
                <ChampionReveal champion={gChamp} title={`Global Cup Champion · ${label}`} recap={global.final_recap} onShare={share} />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
