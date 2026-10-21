import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FastForward, Zap } from "lucide-react";
import { STAT_LABELS, TOURNAMENT, roundLabels, type Bracket, type Match, type Participant } from "@/lib/tournament";
import { cn } from "@/lib/utils";

interface Props {
  bracket: Bracket;
  matches: Match[];
  myUserId?: string | null;
  /** Animate round by round. */
  playback?: boolean;
  onFinished?: () => void;
}

function Name({ p, highlight }: { p: Participant | undefined; highlight: boolean }) {
  if (!p) return <span className="text-muted-foreground italic">Bye</span>;
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", highlight && "text-primary font-bold")}>
      {p.image_url ? <img src={p.image_url} alt="" className="h-5 w-5 shrink-0 rounded object-cover" loading="lazy" /> :
        <span className="h-5 w-5 shrink-0 rounded bg-muted grid place-items-center text-[9px]">🕷</span>}
      <span className="truncate">{p.name}</span>
      {p.is_wild && <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">Wild</Badge>}
      {p.is_veteran && <Badge variant="outline" className="h-4 px-1 text-[9px] shrink-0">Vet</Badge>}
    </span>
  );
}

export default function BracketView({ bracket, matches, myUserId, playback = true, onFinished }: Props) {
  const totalRounds = Math.log2(bracket.size);
  const [shown, setShown] = useState(playback ? 0 : totalRounds);
  const [banner, setBanner] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState<Match | null>(null);
  const byId = useMemo(() => new Map(bracket.participants.map((p) => [p.id, p])), [bracket]);
  const labels = roundLabels(bracket.size);

  useEffect(() => { setShown(playback ? 0 : totalRounds); setBanner(null); }, [bracket.id, playback, totalRounds]);
  useEffect(() => {
    if (shown >= totalRounds) { setBanner(null); onFinished?.(); return; }
    // Cinematic: flash the round's title card, then reveal its results.
    setBanner(labels[Math.min(shown, totalRounds - 1)]);
    // Drumroll: the Final lingers longer before the champion is known.
    const ms = shown === totalRounds - 1 ? TOURNAMENT.REVEAL_MS_PER_ROUND * 1.6 : TOURNAMENT.REVEAL_MS_PER_ROUND;
    const t = setTimeout(() => { setBanner(null); setShown((s) => s + 1); }, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, totalRounds]);

  const mine = (id: string | null) => !!id && !!myUserId && byId.get(id)?.owner_id === myUserId;
  // Large brackets: show my path plus Sweet 16 onward.
  const focusFrom = bracket.size > TOURNAMENT.FOCUS_FROM_ROUND_OF ? Math.log2(bracket.size / TOURNAMENT.FOCUS_FROM_ROUND_OF) + 1 : 1;
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1).filter((r) => full || r >= focusFrom);
  const myEarly = !full && focusFrom > 1
    ? matches.filter((m) => m.round_number < focusFrom && (mine(m.spider_a_id) || mine(m.spider_b_id))).sort((a, b) => a.round_number - b.round_number)
    : [];

  const upset = matches.find((m) => m.id === bracket.upset_match_id);

  const MatchBox = ({ m }: { m: Match }) => {
    const revealed = m.round_number <= shown;
    const isBye = !m.spider_b_id;
    return (
      <button
        type="button"
        disabled={isBye}
        onClick={() => setOpen(m)}
        className={cn(
          "w-full rounded-md border bg-card/80 p-1.5 text-left text-xs transition-all duration-500",
          revealed ? "opacity-100" : "opacity-40",
          (mine(m.spider_a_id) || mine(m.spider_b_id)) ? "border-primary/60" : "border-border",
          m.is_upset && revealed && "ring-1 ring-amber-400/70",
        )}
      >
        {[m.spider_a_id, m.spider_b_id].map((id, i) => {
          const won = revealed && id && m.winner_id === id;
          return (
            <div key={i} className={cn("flex items-center justify-between gap-1 py-0.5", revealed && id && !won && "opacity-50 line-through decoration-muted-foreground/40")}>
              <Name p={id ? byId.get(id) : undefined} highlight={mine(id)} />
              {won && <span className="text-primary shrink-0">✓</span>}
            </div>
          );
        })}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {shown < totalRounds ? `Playing ${labels[Math.min(shown, totalRounds - 1)]}…` : `${bracket.participants.length} spiders · ${totalRounds} rounds`}
        </div>
        {shown < totalRounds && (
          <Button size="sm" variant="outline" onClick={() => setShown(totalRounds)}><FastForward className="h-4 w-4 mr-1" />Skip</Button>
        )}
      </div>

      {myEarly.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Your path</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {myEarly.map((m) => (
              <div key={m.id}>
                <div className="text-[10px] text-muted-foreground mb-0.5">{labels[m.round_number - 1]}</div>
                <MatchBox m={m} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="-mx-3 overflow-x-auto px-3 pb-2">
        <div className="flex gap-3" style={{ minWidth: rounds.length * 168 }}>
          {rounds.map((r) => (
            <div key={r} className="flex w-40 shrink-0 flex-col">
              <div className={cn("mb-2 text-xs font-bold uppercase tracking-wider", r <= shown ? "text-foreground" : "text-muted-foreground")}>{labels[r - 1]}</div>
              <div className="flex flex-1 flex-col justify-around gap-2">
                {matches.filter((m) => m.round_number === r).sort((a, b) => a.slot - b.slot).map((m) => <MatchBox key={m.id} m={m} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {focusFrom > 1 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setFull((f) => !f)}>
          {full ? "Show highlights only" : "View full bracket"}
        </Button>
      )}

      {upset && shown >= upset.round_number && (
        <button type="button" onClick={() => setOpen(upset)} className="w-full rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-left animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300"><Zap className="h-4 w-4" />Upset of the Week</div>
          <div className="mt-1 text-sm">{upset.commentary}</div>
        </button>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {open && (() => {
            const a = byId.get(open.spider_a_id!), b = byId.get(open.spider_b_id!);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">{a?.name} vs {b?.name}</DialogTitle>
                  <DialogDescription>{labels[open.round_number - 1]} · seeds {a?.seed} and {b?.seed}</DialogDescription>
                </DialogHeader>
                {open.round_number <= shown ? (
                  <div className="space-y-2">
                    {open.rounds.map((r, i) => (
                      <div key={i} className="rounded-md border border-border p-2">
                        <div className="text-xs text-muted-foreground mb-1">Round {i + 1} · {STAT_LABELS[r.attribute as keyof typeof STAT_LABELS] ?? r.attribute}</div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                          <span className={cn("truncate", r.winner === "a" && "font-bold text-primary")}>{a?.name}</span>
                          <span className="tabular-nums text-xs text-muted-foreground">{Math.round(r.a_value)} – {Math.round(r.b_value)}</span>
                          <span className={cn("truncate text-right", r.winner === "b" && "font-bold text-primary")}>{b?.name}</span>
                        </div>
                      </div>
                    ))}
                    {open.commentary && <p className="text-sm italic pt-1">"{open.commentary}"</p>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">This match hasn't played yet — hang tight.</p>}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
