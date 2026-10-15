import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { roundLabels, weekLabel } from "@/lib/tournament";

const db = supabase as any;

/** One line per tournament this spider played: week, bracket, how far it got. */
export default function SpiderTournamentHistory({ spiderId }: { spiderId: string }) {
  const [rows, setRows] = useState<{ key: string; weekId: string; label: string; where: string; result: string }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await db.from("matches").select("round_number, winner_id, spider_b_id, brackets!inner(id, type, size, champion_participant_id, week_id, pod_id, game_weeks!inner(starts_at, display_name, status, is_test), private_leagues(name))")
        .or(`spider_a_id.eq.${spiderId},spider_b_id.eq.${spiderId}`)
        .eq("brackets.game_weeks.status", "published").eq("brackets.game_weeks.is_test", false);
      const byBracket = new Map<string, any>();
      for (const m of data ?? []) {
        const b = m.brackets;
        const cur = byBracket.get(b.id) ?? { b, maxRound: 0 };
        cur.maxRound = Math.max(cur.maxRound, m.round_number);
        byBracket.set(b.id, cur);
      }
      setRows([...byBracket.values()].map(({ b, maxRound }) => {
        const labels = roundLabels(b.size);
        const champ = b.champion_participant_id === spiderId;
        return {
          key: b.id, weekId: b.week_id, label: weekLabel(b.game_weeks),
          where: b.type === "global" ? "Global Cup" : b.private_leagues?.name ?? "Pod",
          result: champ ? "🏆 Champion" : `Out in the ${labels[maxRound - 1] ?? "first round"}`,
        };
      }).sort((a, b) => b.weekId.localeCompare(a.weekId)));
    })();
  }, [spiderId]);
  if (!rows.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tournament history</div>
      {rows.map((r) => (
        <Link key={r.key} to={`/week/${r.weekId}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <span className="min-w-0 truncate">{r.label} · {r.where}</span>
          <span className="shrink-0 text-xs font-semibold">{r.result}</span>
        </Link>
      ))}
    </div>
  );
}
