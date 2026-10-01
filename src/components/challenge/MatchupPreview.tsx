import { Badge } from "@/components/ui/badge";
import { Clock, Gift, Shield, Skull } from "lucide-react";
import { MODES, CHALLENGE_TIMING, RULES } from "@/lib/gameRules";
import { strengthLabel, presenceLabel, type ChallengeMode, type ChallengeSpider } from "@/lib/challenges";

function Fighter({ s, label }: { s: ChallengeSpider; label: string }) {
  return (
    <div className="flex-1 min-w-0 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <img src={s.image_url} alt={s.nickname} className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover mx-auto" />
      <p className="font-semibold text-sm truncate mt-1">{s.nickname}</p>
      <p className="text-xs text-muted-foreground">⚡ {s.power_score}</p>
    </div>
  );
}

/** Both fighters, relative strength, rewards, timing and stakes — shown before sending or accepting. */
export default function MatchupPreview({ mine, theirs, mode, opponentName, opponentLastSeen }: {
  mine: ChallengeSpider; theirs: ChallengeSpider | null; mode: ChallengeMode;
  opponentName?: string; opponentLastSeen?: string | null;
}) {
  const m = MODES[mode];
  const strength = theirs ? strengthLabel(mine.power_score, theirs.power_score) : null;
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Fighter s={mine} label="You" />
        <span className="font-bold text-muted-foreground">VS</span>
        {theirs ? <Fighter s={theirs} label={opponentName || "Opponent"} /> : (
          <div className="flex-1 text-center text-xs text-muted-foreground">Open challenge — first eligible player to accept</div>
        )}
      </div>
      {strength && (
        <p className="text-xs text-center">
          <Badge variant={strength.tone === "warn" ? "destructive" : "secondary"} className="mr-1">{strength.label}</Badge>
          <span className="text-muted-foreground">{strength.detail}</span>
        </p>
      )}
      {mode !== "training" && opponentName && (
        <p className="text-[11px] text-center text-muted-foreground">{opponentName}: {presenceLabel(opponentLastSeen)}</p>
      )}
      <ul className="space-y-1.5 text-xs">
        <li className="flex gap-2"><Gift className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" /><span>{m.rewards}</span></li>
        <li className="flex gap-2">
          {mode === "capture" ? <Skull className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" /> : <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />}
          <span className={mode === "capture" ? "text-destructive font-medium" : ""}>{m.risk}</span>
        </li>
        <li className="flex gap-2"><Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <span>
            {mode === "training"
              ? `Starts now against a computer-played opponent. ${m.cooldown}`
              : `${CHALLENGE_TIMING.response} ${CHALLENGE_TIMING.moves} ${CHALLENGE_TIMING.timeout} ${m.cooldown}`}
          </span>
        </li>
      </ul>
      {mode !== "training" && (
        <p className="text-[11px] text-muted-foreground">Deadlines: {RULES.challenge.responseHours}h to respond · {RULES.challenge.moveHours}h per move.</p>
      )}
    </div>
  );
}
