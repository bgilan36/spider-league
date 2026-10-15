import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Camera, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import BracketView from "@/components/week/BracketView";
import ChampionReveal from "@/components/week/ChampionReveal";
import SpiderLogoLoader from "@/components/SpiderLogoLoader";
import { TOURNAMENT, cupShareUrl, logEvent, weekLabel, type Bracket, type GameWeek, type Match } from "@/lib/tournament";

const db = supabase as any;

/** Public, no-login Global Cup page. */
export default function PublicCup() {
  const { weekId = "" } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [week, setWeek] = useState<GameWeek | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: w }, { data: b }] = await Promise.all([
        db.from("game_weeks").select("*").eq("id", weekId).maybeSingle(),
        db.from("brackets").select("*").eq("week_id", weekId).eq("type", "global").maybeSingle(),
      ]);
      setWeek(w); setBracket(b);
      if (b) setMatches((await db.from("matches").select("*").eq("bracket_id", b.id)).data ?? []);
      setLoading(false);
    })();
  }, [weekId]);

  const label = weekLabel(week);
  const champ = bracket?.participants.find((p) => p.id === bracket.champion_participant_id);
  const share = async () => {
    logEvent("share_clicked", { surface: "cup" }, weekId);
    const url = cupShareUrl(weekId);
    try {
      if (navigator.share) await navigator.share({ title: `Global Cup Champion · ${label}`, url });
      else { await navigator.clipboard.writeText(url); toast({ title: "Link copied" }); }
    } catch { /* cancelled */ }
  };

  if (loading) return <div className="min-h-[60vh] grid place-items-center"><SpiderLogoLoader /></div>;
  if (!week || !bracket || !champ) {
    return <div className="container mx-auto px-4 py-12 text-center space-y-3">
      <h1 className="text-2xl font-bold">This Global Cup isn't public yet</h1>
      <Button asChild><Link to="/">Go to Spider League</Link></Button>
    </div>;
  }

  return (
    <div className="container mx-auto max-w-3xl px-3 py-4 sm:py-6 space-y-5">
      <Helmet>
        <title>{`Global Cup Champion · ${label} — Spider League`}</title>
        <meta name="description" content={`${champ.name} won the Spider League Global Cup for the ${label}.`} />
      </Helmet>
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Spider League</div>
        <h1 className="text-3xl font-black">Global Cup · {label}</h1>
      </div>
      <ChampionReveal champion={champ} title={`Global Cup Champion · ${label}`} recap={bracket.final_recap} onShare={share} />
      {!user && (
        <div className="rounded-xl border-2 border-primary bg-primary/10 p-4 text-center space-y-2">
          <div className="text-lg font-black">Think you can find a better spider?</div>
          <p className="text-sm text-muted-foreground">Photograph real spiders all week. Entries lock {TOURNAMENT.LOCK_LABEL}, and results drop Sunday night.</p>
          <Button asChild size="lg" className="w-full h-12"><Link to="/auth"><Camera className="mr-2 h-5 w-5" />Catch your first spider</Link></Button>
        </div>
      )}
      <h2 className="text-lg font-bold">The bracket</h2>
      <BracketView bracket={bracket} matches={matches} myUserId={user?.id} playback={false} />
      <Button variant="outline" className="w-full" onClick={share}><Share2 className="mr-2 h-4 w-4" />Share this Cup</Button>
    </div>
  );
}
