import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { usePlayerActions, spiderState } from "@/hooks/usePlayerActions";
import { MODES } from "@/lib/gameRules";
import { callChallenge, timeLeftLabel, type ChallengeSpider } from "@/lib/challenges";
import MatchupPreview from "./MatchupPreview";

export default function ChallengeResponseDialog({ challengeId, onClose }: { challengeId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { spiders, inBattleIds } = usePlayerActions();
  const [ch, setCh] = useState<any>(null);
  const [theirs, setTheirs] = useState<ChallengeSpider | null>(null);
  const [named, setNamed] = useState<ChallengeSpider | null>(null);
  const [owner, setOwner] = useState<{ name: string; seen: string | null }>({ name: "Challenger", seen: null });
  const [mySpiderId, setMySpiderId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | "cancel" | null>(null);

  useEffect(() => {
    if (!challengeId) return;
    setCh(null); setConsent(false); setMySpiderId(null); setNamed(null);
    (async () => {
      const { data: c } = await supabase.from("battle_challenges").select("*").eq("id", challengeId).maybeSingle();
      setCh(c ?? { missing: true });
      if (!c) return;
      const ids = [c.challenger_spider_id, c.accepter_spider_id].filter(Boolean);
      const [{ data: sp }, { data: pr }, { data: pres }] = await Promise.all([
        supabase.from("spiders").select("id,nickname,species,image_url,power_score,owner_id").in("id", ids),
        supabase.from("profiles").select("id,display_name").eq("id", c.challenger_id).maybeSingle(),
        supabase.from("user_presence").select("last_seen").eq("user_id", c.challenger_id).maybeSingle(),
      ]);
      setTheirs((sp || []).find((s: any) => s.id === c.challenger_spider_id) ?? null);
      const n = (sp || []).find((s: any) => s.id === c.accepter_spider_id) ?? null;
      setNamed(n);
      if (n) setMySpiderId(n.id);
      setOwner({ name: (pr as any)?.display_name || "Challenger", seen: (pres as any)?.last_seen ?? null });
    })();
  }, [challengeId]);

  const ready = spiders.filter((s) => spiderState(s, inBattleIds) === "ready");
  useEffect(() => {
    if (ch && !ch.missing && !mySpiderId && ready[0] && !(ch.is_all_or_nothing && ch.accepter_spider_id)) setMySpiderId(ready[0].id);
  }, [ch, ready, mySpiderId]);

  if (!challengeId) return null;
  const capture = !!ch?.is_all_or_nothing;
  const mode = capture ? "capture" : "friendly";
  const lockedSpider = capture && !!ch?.accepter_spider_id;
  const mine = spiders.find((s) => s.id === mySpiderId) ?? (named && named.owner_id === user?.id ? named as any : null);
  const isMine = ch?.challenger_id === user?.id;
  const expired = ch && ch.status === "OPEN" && new Date(ch.expires_at) <= new Date();
  const open = ch?.status === "OPEN" && !expired;
  const mineReady = !!mine && ready.some((s) => s.id === mine.id);

  const act = async (action: "accept" | "decline" | "cancel") => {
    setBusy(action);
    const r = await callChallenge(action, {
      challengeId, spiderId: mine?.id,
      consent: capture ? { agreed: consent, mySpiderId: mine?.id, opponentSpiderId: theirs?.id } : undefined,
    });
    setBusy(null);
    if (!r.ok) { toast.error(r.error, { id: "challenge-respond" }); return; }
    window.dispatchEvent(new CustomEvent("challenge:accepted"));
    onClose();
    if (action === "accept" && r.data.battleId) navigate(`/battle/${r.data.battleId}`);
    else toast.success(action === "decline" ? "Challenge declined. Nothing changes for either spider." : "Challenge cancelled.", { id: "challenge-respond" });
  };

  return (
    <Dialog open={!!challengeId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{MODES[mode].name}{isMine ? " you sent" : ` from ${owner.name}`}</DialogTitle>
          <DialogDescription>
            {!ch ? "Loading…" : ch.missing ? "This challenge no longer exists."
              : expired ? "This challenge expired. Nothing happened to either spider."
              : ch.status === "OPEN" ? `Respond within ${timeLeftLabel(ch.expires_at)}.`
              : `This challenge is ${String(ch.status).toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>

        {!ch ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : ch.missing ? null : (
          <>
            {!isMine && open && !lockedSpider && (
              <div>
                <p className="text-xs font-medium mb-1">Accept with</p>
                {ready.length === 0 ? <p className="text-xs text-muted-foreground">None of your spiders are ready (resting, retired or in a battle).</p> : (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {ready.map((s) => (
                      <button key={s.id} onClick={() => setMySpiderId(s.id)}
                        className={`shrink-0 w-16 rounded-lg border p-1 text-center ${s.id === mySpiderId ? "border-primary ring-1 ring-primary" : ""}`}>
                        <img src={s.image_url} alt="" className="w-full aspect-square rounded object-cover" />
                        <span className="block text-[10px] truncate">{s.nickname}</span>
                        <span className="block text-[9px] text-muted-foreground">⚡{s.power_score}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {lockedSpider && !isMine && named && !mineReady && open && (
              <p className="text-xs text-destructive">This Capture Battle names {named.nickname}, which can't battle right now (resting, retired or in a battle).</p>
            )}

            {theirs && (mine || isMine) && (
              <MatchupPreview
                mine={isMine ? theirs : mine!}
                theirs={isMine ? named : theirs}
                mode={mode} opponentName={isMine ? undefined : owner.name} opponentLastSeen={owner.seen} />
            )}

            {capture && !isMine && open && mine && theirs && (
              <label className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-xs cursor-pointer">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" aria-label="Agree to Capture Battle stakes" />
                <span>I agree to stake <b>{mine.nickname}</b> against <b>{theirs.nickname}</b>. The loser's spider permanently moves to the winner. {owner.name} already agreed to these two spiders.</span>
              </label>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              {isMine ? (
                open && <Button variant="outline" onClick={() => act("cancel")} disabled={!!busy}>{busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel challenge"}</Button>
              ) : open ? (
                <>
                  {ch.target_user_id === user?.id && <Button variant="ghost" onClick={() => act("decline")} disabled={!!busy}>{busy === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}</Button>}
                  <Button onClick={() => act("accept")} variant={capture ? "destructive" : "default"}
                    disabled={!!busy || !mineReady || (capture && !consent)}>
                    {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : capture ? "Accept Capture Battle" : "Accept Friendly Challenge"}
                  </Button>
                </>
              ) : ch.battle_id ? (
                <Button onClick={() => { onClose(); navigate(`/battle/${ch.battle_id}`); }}>Open battle</Button>
              ) : <Button variant="outline" onClick={onClose}>Close</Button>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
