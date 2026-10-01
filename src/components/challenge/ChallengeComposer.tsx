import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { usePlayerActions, spiderState } from "@/hooks/usePlayerActions";
import { useStartSkillBattle } from "@/components/battle/useStartSkillBattle";
import { usePracticeBattle } from "@/components/battle/usePracticeBattle";
import { MODES } from "@/lib/gameRules";
import { callChallenge, presenceLabel, type ChallengeMode, type ChallengeSpider, type ComposeArgs } from "@/lib/challenges";
import MatchupPreview from "./MatchupPreview";

const MODE_ORDER: ChallengeMode[] = ["friendly", "training", "capture"];
const MODE_HINT: Record<ChallengeMode, string> = {
  friendly: "Default · no spider lost",
  training: "Instant · computer plays them",
  capture: "Opt-in · loser's spider changes owner",
};

export default function ChallengeComposer({ args, onClose }: { args: ComposeArgs | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { spiders, inBattleIds, loading } = usePlayerActions();
  const { open: openTraining, picker } = useStartSkillBattle();
  const { start: startPractice, picker: practicePicker } = usePracticeBattle();
  const [mode, setMode] = useState<ChallengeMode>("friendly");
  const [mySpiderId, setMySpiderId] = useState<string | null>(null);
  const [target, setTarget] = useState<ChallengeSpider | null>(null);
  const [suggestions, setSuggestions] = useState<ChallengeSpider[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const keyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!args) return;
    setMode(args.mode ?? "friendly");
    setTarget(args.targetSpider ?? null);
    setMySpiderId(args.mySpiderId ?? null);
    setConsent(false); setSuggestions(null);
    keyRef.current = crypto.randomUUID();
  }, [args]);

  const ready = useMemo(() => spiders.filter((s) => spiderState(s, inBattleIds) === "ready"), [spiders, inBattleIds]);
  useEffect(() => {
    if (args && !mySpiderId && ready[0]) setMySpiderId(ready[0].id);
  }, [args, ready, mySpiderId]);
  const mine = spiders.find((s) => s.id === mySpiderId) ?? null;
  const mineReady = !!mine && ready.some((s) => s.id === mine.id);

  // Suggest similar-strength eligible opponents when none was chosen.
  useEffect(() => {
    if (!args || args.targetSpider || !mine) return;
    setSuggestions(null);
    callChallenge("suggest", { spiderId: mine.id }).then((r) => setSuggestions(r.ok ? r.data.opponents : []));
  }, [args, mine?.id]);

  useEffect(() => { setConsent(false); }, [mode, target?.id, mySpiderId]);

  if (!args) return null;

  const send = async () => {
    if (!mine) return;
    if (mode === "training") {
      onClose();
      openTraining({ spiderId: mine.id, opponentSpiderId: target?.id });
      return;
    }
    setSending(true);
    const r = await callChallenge("send", {
      mode, spiderId: mine.id, opponentSpiderId: target?.id, idempotencyKey: keyRef.current,
      consent: mode === "capture" ? { agreed: consent, mySpiderId: mine.id, opponentSpiderId: target?.id } : undefined,
    });
    setSending(false);
    if (!r.ok) { toast.error(r.error, { id: "challenge-send" }); return; }
    toast.success(target ? `${MODES[mode].name} sent to ${target.owner_name || "the other player"}. They'll be notified.` : "Open Friendly Challenge posted.", { id: "challenge-send" });
    window.dispatchEvent(new CustomEvent("challenge:created"));
    onClose();
  };

  const captureBlocked = mode === "capture" && !target;
  const canSend = !!mine && mineReady && !sending && !captureBlocked && (mode !== "capture" || consent);

  return (
    <>
      <Dialog open={!!args} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Challenge</DialogTitle>
            <DialogDescription>Pick a mode, check the matchup, then send.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Battle mode">
            {MODE_ORDER.map((k) => (
              <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)}
                className={`rounded-lg border p-2 text-left min-h-14 transition-colors ${mode === k ? (k === "capture" ? "border-destructive bg-destructive/10" : "border-primary bg-primary/10") : "border-border"}`}>
                <span className="block text-xs font-semibold">{MODES[k].name}</span>
                <span className="block text-[10px] text-muted-foreground leading-tight">{MODE_HINT[k]}</span>
              </button>
            ))}
          </div>

          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : spiders.length === 0 ? (
            <p className="text-sm text-muted-foreground">You need a spider first. <Button variant="link" className="p-0 h-auto" onClick={() => { onClose(); navigate("/upload"); }}>Upload one</Button></p>
          ) : (
            <div>
              <p className="text-xs font-medium mb-1">Your fighter</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {spiders.map((s) => {
                  const st = spiderState(s, inBattleIds);
                  return (
                    <button key={s.id} onClick={() => setMySpiderId(s.id)} disabled={st !== "ready"}
                      title={st === "ready" ? s.nickname : `${s.nickname}: ${st === "cooldown" ? "resting" : st === "retired" ? "retired" : "in a battle"}`}
                      className={`shrink-0 w-16 rounded-lg border p-1 text-center disabled:opacity-40 ${s.id === mySpiderId ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                      <img src={s.image_url} alt="" className="w-full aspect-square rounded object-cover" />
                      <span className="block text-[10px] truncate">{s.nickname}</span>
                      <span className="block text-[9px] text-muted-foreground">{st === "ready" ? `⚡${s.power_score}` : st === "cooldown" ? "Resting" : st === "retired" ? "Retired" : "In battle"}</span>
                    </button>
                  );
                })}
              </div>
              {!ready.length && <p className="text-xs text-muted-foreground mt-1">No spider is ready: they're resting, retired or already in a battle.</p>}
            </div>
          )}

          {mine && !args.targetSpider && (
            <div>
              <p className="text-xs font-medium mb-1">Opponent</p>
              {suggestions === null ? <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Finding similar-strength players…</p>
                : suggestions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-3 text-xs space-y-2">
                    <p>No eligible players near {mine.nickname}'s Power right now.</p>
                    <Button size="sm" variant="secondary" onClick={() => { onClose(); startPractice(mine.id); }}>Practice battle (computer opponent)</Button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {mode === "friendly" && (
                      <button onClick={() => setTarget(null)} className={`w-full rounded-lg border p-2 text-left text-xs ${!target ? "border-primary bg-primary/10" : ""}`}>
                        Open challenge — anyone eligible can accept
                      </button>
                    )}
                    {suggestions.map((o) => (
                      <button key={o.id} onClick={() => setTarget(o)}
                        className={`w-full flex items-center gap-2 rounded-lg border p-2 text-left ${target?.id === o.id ? "border-primary bg-primary/10" : ""}`}>
                        <img src={o.image_url} alt="" className="w-9 h-9 rounded object-cover" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{o.nickname} · ⚡{o.power_score}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">{o.owner_name} · {presenceLabel(o.owner_last_seen)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}

          {mine && (
            <MatchupPreview mine={mine} theirs={target} mode={mode} opponentName={target?.owner_name} opponentLastSeen={target?.owner_last_seen} />
          )}

          {captureBlocked && <p className="text-xs text-destructive">Capture Battles need a specific opponent spider — pick one above.</p>}
          {mode === "capture" && mine && target && (
            <label className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-xs cursor-pointer">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" aria-label="Agree to Capture Battle stakes" />
              <span>I'm staking <b>{mine.nickname}</b> against <b>{target.nickname}</b>. If I lose, {mine.nickname} permanently becomes the other player's spider. They must agree to these same two spiders before anything happens.</span>
            </label>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={send} disabled={!canSend} variant={mode === "capture" ? "destructive" : "default"}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "training" ? "Start Training Battle" : mode === "capture" ? "Send Capture Battle" : target ? "Send Friendly Challenge" : "Post open challenge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {picker}
      {practicePicker}
    </>
  );
}
