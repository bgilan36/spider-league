import { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Clock, Trophy, Users, Sparkles, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useThisWeek, useCountdown, type MySpider } from "@/hooks/useThisWeek";
import { TOURNAMENT, logEvent, weekLabel } from "@/lib/tournament";
import { cn } from "@/lib/utils";

function Countdown({ locksAt }: { locksAt: string }) {
  const c = useCountdown(locksAt);
  if (!c) return null;
  const cells = [
    { v: c.d, l: "days" }, { v: c.h, l: "hrs" }, { v: c.m, l: "min" }, { v: c.s, l: "sec" },
  ];
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="Time until entries lock">
      {cells.map((x) => (
        <div key={x.l} className="rounded-lg bg-background/60 border border-border py-2 text-center">
          <div className="text-2xl font-black tabular-nums leading-none">{String(x.v).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{x.l}</div>
        </div>
      ))}
    </div>
  );
}

function SpiderTile({ s, badge, onClick, selected }: { s: MySpider; badge?: string; onClick?: () => void; selected?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition min-h-[64px]",
        selected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card/60 hover:border-primary/50",
      )}
    >
      <img src={s.image_url} alt={s.nickname} className="h-12 w-12 shrink-0 rounded-md object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{s.nickname}</div>
        <div className="truncate text-xs text-muted-foreground">{s.species}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold tabular-nums">{s.power_score}</div>
        <div className="text-[10px] text-muted-foreground">Power</div>
      </div>
      {badge && <Badge className="shrink-0 bg-primary/20 text-primary border-primary/40" variant="outline">{badge}</Badge>}
    </button>
  );
}

export default function ThisWeekCard() {
  const tw = useThisWeek();
  const { toast } = useToast();
  const [swapOpen, setSwapOpen] = useState(false);
  const [vetOpen, setVetOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (tw.loading && !tw.week) {
    return <Card className="border-primary/30"><CardContent className="p-6 h-48 animate-pulse" /></Card>;
  }

  const entries = tw.entryIds.map((id) => tw.fresh.find((s) => s.id === id)).filter(Boolean) as MySpider[];
  const veteran = tw.veterans.find((s) => s.id === tw.veteranId) ?? null;
  const max = TOURNAMENT.MAX_ENTRIES_PER_USER;

  const openSwap = () => { setDraft(tw.entryIds); setSwapOpen(true); };
  const toggle = (id: string) => setDraft((d) => d.includes(id) ? d.filter((x) => x !== id) : d.length >= max ? d : [...d, id]);

  const saveEntries = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc("set_my_week_entries" as any, { p_spider_ids: draft });
    setSaving(false);
    const res = data as any;
    if (error || !res?.ok) { toast({ title: "Couldn't update entries", description: res?.error ?? error?.message, variant: "destructive" }); return; }
    logEvent("entry_changed", { count: draft.length, kind: "fresh" }, tw.week?.id);
    toast({ title: "Entries updated", description: `${draft.length} spider${draft.length === 1 ? "" : "s"} entered.` });
    setSwapOpen(false);
    tw.reload();
  };

  const saveVeteran = async (id: string | null) => {
    setSaving(true);
    const { data, error } = await supabase.rpc("set_my_week_veteran" as any, { p_spider_id: id });
    setSaving(false);
    const res = data as any;
    if (error || !res?.ok) { toast({ title: "Couldn't field veteran", description: res?.error ?? error?.message, variant: "destructive" }); return; }
    logEvent("entry_changed", { count: id ? 1 : 0, kind: "veteran" }, tw.week?.id);
    toast({ title: id ? "Veteran fielded" : "Veteran removed", description: id ? "They'll fight in your pods only." : undefined });
    setVetOpen(false);
    tw.reload();
  };

  return (
    <div className="space-y-4">
      {tw.unwatched && (
        <Link
          to={`/week/${tw.unwatched.id}`}
          className="block rounded-xl border-2 border-primary bg-gradient-to-br from-primary/25 via-primary/10 to-transparent p-4 shadow-lg shadow-primary/20 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-black">Your results are in</div>
              <div className="text-sm text-muted-foreground truncate">{weekLabel(tw.unwatched)} · watch your brackets play out</div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0" />
          </div>
        </Link>
      )}

      <Card className="overflow-hidden border-primary/30">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-primary">This week</div>
              <h2 className="text-xl sm:text-2xl font-black">{weekLabel(tw.week)}</h2>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
              <Clock className="h-3.5 w-3.5" /> Locks {TOURNAMENT.LOCK_LABEL}
            </div>
          </div>

          {tw.week ? <Countdown locksAt={tw.week.locks_at} /> : (
            <p className="text-sm text-muted-foreground">This week's tournament is being decided. The next week opens shortly.</p>
          )}

          <Button asChild size="lg" className="w-full h-14 text-lg font-bold">
            <Link to="/upload"><Camera className="mr-2 h-5 w-5" /> Catch a spider</Link>
          </Button>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold">My entries <span className="text-muted-foreground font-normal">({entries.length || (veteran ? 1 : 0)}/{Math.min(max, Math.max(tw.fresh.length, 1))} fresh)</span></h3>
              {tw.fresh.length > 0 && tw.week && (
                <Button variant="ghost" size="sm" onClick={openSwap}>Swap</Button>
              )}
            </div>
            {entries.length > 0 ? (
              <div className="space-y-2">
                {entries.map((s) => <SpiderTile key={s.id} s={s} badge="Fresh" onClick={openSwap} />)}
                {!tw.explicit && tw.fresh.length > max && (
                  <p className="text-xs text-muted-foreground">We've entered your top {max} by Power. Tap Swap to choose.</p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <p className="text-sm">
                  The <b>Global Cup</b> is for this week's catches only. Catch a spider before {TOURNAMENT.LOCK_LABEL} to enter.
                </p>
                {veteran ? (
                  <div className="space-y-2">
                    <SpiderTile s={veteran} badge="Veteran" onClick={() => setVetOpen(true)} />
                    <p className="text-xs text-muted-foreground">Fighting in your pods only, at {Math.round(TOURNAMENT.VETERAN_MULTIPLIER * 100)}% strength.</p>
                  </div>
                ) : tw.pods.length > 0 && tw.veterans.length > 0 && tw.week ? (
                  <Button variant="outline" className="w-full" onClick={() => setVetOpen(true)}>
                    <Shield className="mr-2 h-4 w-4" /> Field a veteran for my pods
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          {tw.pods.length > 0 && (
            <div>
              <h3 className="font-bold mb-2 flex items-center gap-2"><Users className="h-4 w-4" /> Pod activity</h3>
              <div className="space-y-2">
                {tw.pods.map((p) => (
                  <Link key={p.podId} to={`/leagues/${p.podId}`} className="block rounded-lg border border-border bg-card/50 p-3">
                    <div className="text-sm font-semibold mb-1.5">{p.podName}</div>
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                      {p.members.map((m) => (
                        <span key={m.userId} className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs border",
                          m.entered ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                          {m.name} · {m.entered} entered
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {tw.lastPublished && !tw.unwatched && (
            <Link to={`/week/${tw.lastPublished.id}`} className="flex items-center justify-between text-sm text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Rewatch {weekLabel(tw.lastPublished)}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </CardContent>
      </Card>

      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose your entries</DialogTitle>
            <DialogDescription>Pick up to {max} of this week's catches — only spiders caught since this week opened are eligible. They enter the Global Cup and your pods.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {tw.fresh.map((s) => (
              <SpiderTile key={s.id} s={s} badge={draft.includes(s.id) ? "Entered" : undefined} selected={draft.includes(s.id)} onClick={() => toggle(s.id)} />
            ))}
          </div>
          <Button className="w-full h-12" disabled={saving || draft.length === 0} onClick={saveEntries}>
            Save {draft.length}/{max}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={vetOpen} onOpenChange={setVetOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Field a veteran</DialogTitle>
            <DialogDescription>
              No fresh catch this week? Send one spider from your collection into your pods (not the Global Cup). Veterans fight at {Math.round(TOURNAMENT.VETERAN_MULTIPLIER * 100)}% of their stats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {tw.veterans.slice(0, 30).map((s) => (
              <SpiderTile key={s.id} s={s} selected={s.id === tw.veteranId} badge={s.id === tw.veteranId ? "Fielded" : undefined} onClick={() => saveVeteran(s.id)} />
            ))}
          </div>
          {tw.veteranId && <Button variant="outline" className="w-full" disabled={saving} onClick={() => saveVeteran(null)}>Remove veteran</Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
