import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { BUCKET_LABEL, type ZoneBucket } from "@/lib/battle/stances";

const KEY = "sl-battle-coach-hidden";

export function useCoachVisible(enabled: boolean) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  const hide = () => { setHidden(true); try { localStorage.setItem(KEY, "1"); } catch { /* */ } };
  return { show: enabled && !hidden, hide };
}

/** Short contextual tip shown above the skill meter during practice / first battles. */
export function BattleCoach({ phase, round, onHide }: { phase: "attack" | "defense"; round: number; onHide: () => void }) {
  const text = phase === "attack"
    ? round <= 1
      ? "Your turn to attack. Tap to stop the moving marker inside the green Skill Zone — the yellow center is Perfect and rolls higher dice."
      : "Your attack stance changes what a good roll does: Power Strike crits harder, Quick Strike adds a bonus hit on Perfect, Venom Bite slips past defense."
    : round <= 2
      ? "Incoming hit! Stop the marker in the Skill Zone to roll a strong defense die and take less damage."
      : "Your defense stance matters here: Iron Web soaks damage, Evasive can dodge on high rolls, Counter-Sting powers up your next attack.";
  return (
    <div className="mb-3 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs" role="note">
      <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-foreground">{text}</p>
      <button onClick={onHide} aria-label="Hide battle tips" className="p-1 -m-1 text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** One useful lesson, derived from how the player actually timed their locks. */
export function combatLesson(myBuckets: ZoneBucket[], iWon: boolean, oppPower: number, myPower: number): string {
  const n = myBuckets.length || 1;
  const misses = myBuckets.filter((b) => b === "miss").length;
  const perfects = myBuckets.filter((b) => b === "perfect").length;
  if (misses / n >= 0.5) return `You ${BUCKET_LABEL.miss.toLowerCase()} the Skill Zone on ${misses} of ${n} locks. Wait for the marker to enter the green band before tapping — timing matters more than speed.`;
  if (perfects === 0) return "You hit the Skill Zone but never Perfect. Aim for the yellow center: Perfect locks roll the highest dice, and Quick Strike turns them into a bonus hit.";
  if (!iWon && oppPower > myPower) return `Your opponent had more Power (⚡${oppPower} vs ⚡${myPower}). When you're the underdog, your Skill Zone gets wider — good timing can close the gap.`;
  if (!iWon) return "Try a different stance next time: Venom Bite ignores defense against tanky spiders, and Evasive can dodge big hits entirely.";
  return `Great timing — ${perfects} Perfect lock${perfects === 1 ? "" : "s"}. Against stronger opponents, pair that with Power Strike for big crits.`;
}
