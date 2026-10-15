import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Share2, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cupShareUrl, logEvent, weekLabel } from "@/lib/tournament";

const db = supabase as any;

/** Permanent trophies for a player. Hidden when they have none. */
export default function TrophyShelf({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await db.from("trophies").select("id, kind, week_id, pod_id, spider_id, game_weeks(starts_at, display_name), spiders(nickname, image_url), private_leagues(name)")
        .eq("user_id", userId).order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, [userId]);
  if (!rows.length) return null;

  const share = async (weekId: string) => {
    logEvent("share_clicked", { surface: "trophy" }, weekId);
    const url = cupShareUrl(weekId);
    try {
      if (navigator.share) await navigator.share({ title: "Spider League Global Cup", url });
      else { await navigator.clipboard.writeText(url); toast({ title: "Link copied" }); }
    } catch { /* cancelled */ }
  };

  return (
    <Card className="border-amber-400/40">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Trophy className="h-5 w-5 text-amber-300" />Trophies</CardTitle></CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {rows.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-2">
            {t.spiders?.image_url ? <img src={t.spiders.image_url} alt="" className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-muted" />}
            <Link to={`/week/${t.week_id}`} className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                {t.kind === "global_cup" ? "🏆 Global Cup" : `🥇 ${t.private_leagues?.name ?? "Pod"} champion`}
              </div>
              <div className="font-semibold truncate">{t.spiders?.nickname ?? "Spider"}</div>
              <div className="text-xs text-muted-foreground">{weekLabel(t.game_weeks)}</div>
            </Link>
            {t.kind === "global_cup" && (
              <Button size="icon" variant="ghost" aria-label="Share trophy" onClick={() => share(t.week_id)}><Share2 className="h-4 w-4" /></Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
