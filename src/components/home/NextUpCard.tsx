import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Swords, Bell, Zap, Sparkles, RefreshCcw, Clock, Camera } from "lucide-react";
import { usePlayerActions, spiderState, cooldownEndsAt } from "@/hooks/usePlayerActions";
import { useStartSkillBattle } from "@/components/battle/useStartSkillBattle";
import { MODES, RULES } from "@/lib/gameRules";

function fmtLeft(ms: number) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** One dominant action chosen from real player state. */
export default function NextUpCard() {
  const navigate = useNavigate();
  const { loading, spiders, battles, incoming, inBattleIds } = usePlayerActions();
  const { open: openBattle, picker } = useStartSkillBattle();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  if (loading) {
    return <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking what's next…</Card>;
  }

  const now = Date.now();
  const states = spiders.map((s) => ({ s, st: spiderState(s, inBattleIds, now) }));
  const ready = states.filter((x) => x.st === "ready").map((x) => x.s);
  const cooling = states.filter((x) => x.st === "cooldown").map((x) => x.s).sort((a, b) => cooldownEndsAt(a) - cooldownEndsAt(b));
  const retired = states.filter((x) => x.st === "retired").map((x) => x.s);
  const active = spiders.length - retired.length;

  let icon = Zap, title = "", body = "", cta = "", act: () => void = () => {}, secondary: { label: string; act: () => void } | null = null;
  const myTurn = battles.find((b) => b.myTurn);

  if (myTurn) {
    icon = Swords; title = "Resume your battle";
    body = `${myTurn.mySpider} vs ${myTurn.oppSpider} is waiting on your move.`;
    cta = "Resume battle"; act = () => navigate(`/battle/${myTurn.id}`);
  } else if (incoming.length) {
    const c = incoming[0];
    icon = Bell; title = c.capture ? `${MODES.capture.name} challenge` : "Incoming challenge";
    body = `${c.challengerSpider} challenged ${c.mySpider}.${c.capture ? " The loser's spider changes owners." : ""}`;
    cta = "Respond"; act = () => navigate("/battle-history#action-needed");
  } else if (ready.length) {
    const s = ready[0];
    icon = Zap; title = `${s.nickname} is ready`;
    body = `Start a ${MODES.training.long}: no ownership risk, winner earns +${RULES.battle.spiderXpWin} XP.`;
    cta = "Battle now"; act = () => openBattle({ spiderId: s.id });
    secondary = { label: "Wild Skirmish", act: () => navigate("/skirmish") };
  } else if (spiders.length === 0) {
    icon = Sparkles; title = "Get your first spider";
    body = "Catch a real spider with your camera to build your Starting 5.";
    cta = "Upload a spider"; act = () => navigate("/upload");
  } else if (retired.length && active < RULES.roster.baseSlots && cooling.length === 0) {
    icon = RefreshCcw; title = "Re-enlist a spider";
    body = `${retired[0].nickname} is retired. Re-enlist it for ${RULES.roster.eligibleDays} days from your Starting 5.`;
    cta = "Open Starting 5"; act = () => document.getElementById("starting-5")?.scrollIntoView({ behavior: "smooth" });
    secondary = { label: "Upload a spider", act: () => navigate("/upload") };
  } else if (cooling.length) {
    const s = cooling[0];
    icon = Clock; title = `${s.nickname} is ready in ${fmtLeft(cooldownEndsAt(s) - now)}`;
    body = `Every Starting 5 spider is resting after battle. Wild Skirmishes (${RULES.skirmish.dailyLimit}/day) have no cooldown.`;
    cta = "Wild Skirmish"; act = () => navigate("/skirmish");
    secondary = { label: "Upload a spider", act: () => navigate("/upload") };
  } else {
    icon = Camera; title = "Add a spider to battle";
    body = "Upload a new spider to fill your Starting 5.";
    cta = "Upload a spider"; act = () => navigate("/upload");
  }

  const Icon = icon;
  return (
    <Card className="p-4 sm:p-5 border-primary/40 bg-primary/5" aria-label="Next up">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">Next up</p>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-base sm:text-lg leading-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{body}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <Button size="lg" className="w-full sm:w-auto" onClick={act}>{cta}</Button>
        {secondary && <Button size="lg" variant="ghost" className="w-full sm:w-auto" onClick={secondary.act}>{secondary.label}</Button>}
      </div>
      {picker}
    </Card>
  );
}
