import { MODES, ROSTER_COPY, RANKING_COPY, RULES, type ModeKey } from "@/lib/gameRules";

const ORDER: ModeKey[] = ["training", "friendly", "capture", "skirmish"];

/** Canonical rules, rendered from src/lib/gameRules.ts. */
export function ModeRulesList({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      {ORDER.map((k) => {
        const m = MODES[k];
        return (
          <div key={k} className="rounded-md border border-border p-3">
            <p className={`font-semibold ${k === "capture" ? "text-destructive" : "text-foreground"}`}>{m.name}</p>
            <p className="text-muted-foreground">{m.who}</p>
            {!compact && (
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li><strong className="text-foreground">Rewards:</strong> {m.rewards}</li>
                <li><strong className="text-foreground">Eligibility:</strong> {m.eligibility}</li>
                <li><strong className="text-foreground">Cooldown:</strong> {m.cooldown}</li>
                <li><strong className="text-foreground">Risk:</strong> {m.risk}</li>
              </ul>
            )}
            {compact && <p className="mt-1 text-xs text-muted-foreground">{m.risk} {m.cooldown}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function RosterRulesList() {
  return (
    <div className="space-y-2 text-sm">
      <p>• {ROSTER_COPY.summary()}</p>
      <p>• {ROSTER_COPY.eligibility}</p>
      <p>• {ROSTER_COPY.retirement}</p>
      <p>• {ROSTER_COPY.bonusSlot}</p>
      <p>• {ROSTER_COPY.uploads}</p>
    </div>
  );
}

export function RankingRulesList() {
  return (
    <div className="space-y-2 text-sm">
      <p>• {RANKING_COPY.formula}</p>
      <p>• {RANKING_COPY.allTime}</p>
      <p>• {RANKING_COPY.weekly}</p>
      <p>• {RANKING_COPY.spiders}</p>
      <p>• Spiders level up from XP; each level adds +{RULES.levelPowerBonus} Power. Battle wins also add small stat boosts that raise Power.</p>
      <p>• Results and rewards are decided on the server.</p>
    </div>
  );
}
