import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { weekLabel, type Bracket, type GameWeek } from "@/lib/tournament";

const db = supabase as any;

interface ChampRow {
  week: GameWeek;
  bracket: Bracket;
}

/** Persistent gallery of past Global Cup champions. Hidden until a week has published. */
export default function PastChampions() {
  const [rows, setRows] = useState<ChampRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: weeks } = await db
        .from("game_weeks")
        .select("*")
        .eq("status", "published")
        .eq("is_test", false)
        .order("starts_at", { ascending: false })
        .limit(12);
      const list = (weeks ?? []) as GameWeek[];
      if (!list.length) return;
      const { data: bs } = await db
        .from("brackets")
        .select("*")
        .eq("type", "global")
        .in("week_id", list.map((w) => w.id));
      const byWeek = new Map(((bs ?? []) as Bracket[]).map((b) => [b.week_id, b]));
      setRows(
        list
          .map((w) => ({ week: w, bracket: byWeek.get(w.id)! }))
          .filter((r) => r.bracket?.champion_participant_id),
      );
    })();
  }, []);

  if (!rows.length) return null;

  return (
    <section className="mb-6 sm:mb-8">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-300" />
        <h2 className="text-xl sm:text-2xl font-bold">Hall of Champions</h2>
      </div>
      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2">
        {rows.map(({ week, bracket }) => {
          const champ = bracket.participants.find((p) => p.id === bracket.champion_participant_id);
          if (!champ) return null;
          return (
            <Link
              key={week.id}
              to={`/week/${week.id}`}
              className="group w-40 shrink-0 overflow-hidden rounded-xl border border-amber-400/40 bg-card transition-colors hover:border-amber-300"
            >
              {champ.image_url ? (
                <img src={champ.image_url} alt={champ.name} className="aspect-square w-full object-cover" loading="lazy" />
              ) : (
                <div className="aspect-square w-full grid place-items-center bg-muted text-4xl">🕷️</div>
              )}
              <div className="p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">{weekLabel(week)}</div>
                <div className="truncate text-sm font-bold">{champ.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {champ.species}
                  {champ.owner_name ? ` · ${champ.owner_name}` : ""}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
