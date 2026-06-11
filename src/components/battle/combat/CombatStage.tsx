import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart, FastForward } from "lucide-react";
import FighterToken, { type TokenState } from "./FighterToken";
import HpBar from "./HpBar";
import DamageFloatLayer, { type FloatItem } from "./DamageFloat";
import StrikeFx from "./effects/StrikeFx";
import {
  pickAttackStyle, useReducedMotion, TIMING,
  type AttackStyle, type CombatEvent, type CombatStats,
} from "./combatFx";

export interface CombatFighter {
  name: string;
  imageUrl: string;
  maxHp: number;
  stats: CombatStats;
}

interface Props {
  me: CombatFighter;
  opp: CombatFighter;
  myHp: number;
  oppHp: number;
  /** Append-only queue of combat events to play. */
  events: CombatEvent[];
  /** Fired once an event finishes animating. */
  onEventComplete?: (index: number) => void;
  /** When provided, shows the Skip button. */
  onSkip?: () => void;
}

/**
 * Drop-in cinematic arena. Pure presentational — the parent owns
 * HP state and decides what events to feed. The stage only animates.
 */
export default function CombatStage({
  me, opp, myHp, oppHp, events, onEventComplete, onSkip,
}: Props) {
  const reducedMotion = useReducedMotion();

  const [meState,  setMeState]  = useState<TokenState>("idle");
  const [oppState, setOppState] = useState<TokenState>("idle");
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [fxStyle, setFxStyle] = useState<AttackStyle | null>(null);
  const [fxDir, setFxDir] = useState<1 | -1>(1);
  const [chip, setChip] = useState<{ side: "me" | "opp"; text: string } | null>(null);
  const [poison, setPoison] = useState<{ side: "me" | "opp"; until: number } | null>(null);
  const [shakeScreen, setShakeScreen] = useState(false);
  const [flash, setFlash] = useState(false);
  const [dustAt, setDustAt] = useState<{ id: number; side: "me" | "opp" } | null>(null);

  // Mark which event indices we've consumed so we don't double-play.
  const playedRef = useRef(0);
  const runningRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const skippedRef = useRef(false);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };
  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, reducedMotion ? Math.min(ms, 120) : ms);
    timersRef.current.push(id);
  };

  useEffect(() => () => clearTimers(), []);

  // Whenever new events arrive, schedule them in sequence.
  useEffect(() => {
    if (playedRef.current >= events.length) return;
    if (runningRef.current) return;       // already animating; new events will be picked up after current loop finishes
    runningRef.current = true;
    let cursor = playedRef.current;

    const playNext = () => {
      if (skippedRef.current) { runningRef.current = false; return; }
      if (cursor >= events.length) {
        runningRef.current = false;
        // In case more events were appended while we were animating, kick a new loop.
        if (playedRef.current < events.length) {
          runningRef.current = true;
          cursor = playedRef.current;
          playNext();
        }
        return;
      }
      const ev = events[cursor];
      const idx = cursor;
      cursor += 1;
      playedRef.current = cursor;
      playEvent(ev, () => {
        onEventComplete?.(idx);
        playNext();
      });
    };
    playNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  const spawnFloat = (item: Omit<FloatItem, "id" | "reducedMotion">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFloats((f) => [...f, { ...item, id, reducedMotion }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1100);
  };

  const playEvent = (ev: CombatEvent, done: () => void) => {
    const attackerIsMe = ev.attacker === "me";
    const defenderSide: 1 | -1 = attackerIsMe ? 1 : -1;
    const style: AttackStyle =
      ev.style ?? pickAttackStyle((attackerIsMe ? me : opp).stats);

    // Dodge branch
    if (ev.dodged) {
      // Small sidestep on defender, MISS tag over attacker
      if (attackerIsMe) setOppState("idle"); else setMeState("idle");
      spawnFloat({ kind: "miss", side: attackerIsMe ? -1 : 1 });
      after(TIMING.dodgeTotal, done);
      return;
    }

    // Lunge
    if (attackerIsMe) setMeState("lunge"); else setOppState("lunge");

    // Strike FX at mid-lunge
    after(TIMING.lunge, () => {
      setFxStyle(style);
      setFxDir(defenderSide);
      // Defender takes hit
      if (attackerIsMe) setOppState("hit"); else setMeState("hit");
      // Damage number
      spawnFloat({
        kind: ev.crit ? "crit" : "damage",
        value: Math.max(0, ev.damage),
        side: defenderSide,
      });
      // Style-specific extras
      if (style === "slam") {
        setShakeScreen(true);
        setDustAt({ id: Date.now(), side: attackerIsMe ? "opp" : "me" });
        window.setTimeout(() => setShakeScreen(false), 380);
      }
      if (style === "blur") {
        // double-strike: second damage float after a beat
        window.setTimeout(() => {
          spawnFloat({ kind: "damage", value: Math.max(1, Math.round(ev.damage / 3)), side: defenderSide });
        }, 160);
      }
      if (style === "web") {
        const side = attackerIsMe ? "opp" : "me";
        setChip({ side, text: "WRAPPED" });
        window.setTimeout(() => setChip(null), 1500);
      }
      if (style === "fang") {
        const side = attackerIsMe ? "opp" : "me";
        const until = Date.now() + 1800;
        setPoison({ side, until });
        window.setTimeout(() => {
          setPoison((p) => (p && p.until === until ? null : p));
        }, 1900);
      }
    });

    // Snap back / recover
    after(TIMING.lunge + TIMING.strike + 60, () => {
      setFxStyle(null);
      if (attackerIsMe) setMeState("idle");
      else setOppState("idle");
    });

    after(TIMING.lunge + TIMING.strike + TIMING.recoil, () => {
      if (attackerIsMe) setOppState("idle"); else setMeState("idle");
    });

    if (ev.finisher) {
      after(TIMING.lunge + TIMING.strike + 80, () => setFlash(true));
      after(TIMING.lunge + TIMING.strike + 520, () => setFlash(false));
      after(TIMING.finisher, () => {
        // Loser tips over, winner pulses
        if (attackerIsMe) { setOppState("dead"); setMeState("winner"); }
        else              { setMeState("dead");  setOppState("winner"); }
        done();
      });
      return;
    }

    const total = TIMING.baseTotal + (ev.crit ? TIMING.critExtra : 0);
    after(total, done);
  };

  const skip = () => {
    skippedRef.current = true;
    clearTimers();
    // Flush remaining events synchronously.
    const remaining = events.slice(playedRef.current);
    playedRef.current = events.length;
    remaining.forEach((_, i) => onEventComplete?.(playedRef.current - remaining.length + i));
    // Snap to terminal states based on last event if it's a finisher.
    const last = events[events.length - 1];
    if (last?.finisher) {
      const attackerIsMe = last.attacker === "me";
      if (attackerIsMe) { setOppState("dead"); setMeState("winner"); }
      else              { setMeState("dead");  setOppState("winner"); }
    } else {
      setMeState("idle"); setOppState("idle");
    }
    setFxStyle(null); setChip(null); setPoison(null); setFlash(false);
    onSkip?.();
  };

  const lowHp = useMemo(
    () => (myHp / Math.max(1, me.maxHp) <= 0.25) || (oppHp / Math.max(1, opp.maxHp) <= 0.25),
    [myHp, oppHp, me.maxHp, opp.maxHp],
  );

  return (
    <div
      className={
        "relative overflow-hidden rounded-xl border bg-gradient-to-b from-zinc-950 to-zinc-900 " +
        "px-4 py-5 sm:py-6 " +
        (shakeScreen && !reducedMotion ? "animate-screen-shake" : "")
      }
    >
      {/* Cobweb background */}
      <CobwebPattern />
      {/* Vignette pulse on low HP */}
      {lowHp && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(127,29,29,0.45) 100%)",
            animation: reducedMotion ? undefined : "pulse 1.4s ease-in-out infinite",
          }}
        />
      )}
      {/* Finisher flash */}
      {flash && (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-white animate-finisher-flash" />
      )}

      {/* Skip — always visible */}
      {onSkip && (
        <Button
          variant="ghost" size="sm"
          onClick={skip}
          className="absolute top-2 right-2 z-30 h-7 px-2 text-xs text-white/80 hover:text-white hover:bg-white/10"
        >
          <FastForward className="h-3 w-3 mr-1" /> Skip
        </Button>
      )}

      {/* HP bars */}
      <div className="relative z-10 grid grid-cols-2 gap-4 mb-4">
        <FighterHud
          name={me.name} hp={myHp} maxHp={me.maxHp}
          critical={lowHp} align="left"
          poisoned={poison?.side === "me" && Date.now() < poison.until}
        />
        <FighterHud
          name={opp.name} hp={oppHp} maxHp={opp.maxHp}
          critical={lowHp} align="right"
          poisoned={poison?.side === "opp" && Date.now() < poison.until}
        />
      </div>

      {/* Arena */}
      <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 h-36 sm:h-40">
        <div className="flex justify-end pr-2">
          <FighterToken
            imageUrl={me.imageUrl} name={me.name} side="left"
            state={meState}
            statusChip={chip?.side === "me" ? chip.text : null}
            reducedMotion={reducedMotion}
          />
        </div>
        <div className="text-xs font-bold text-white/40 tracking-widest select-none">VS</div>
        <div className="flex justify-start pl-2">
          <FighterToken
            imageUrl={opp.imageUrl} name={opp.name} side="right"
            state={oppState}
            statusChip={chip?.side === "opp" ? chip.text : null}
            reducedMotion={reducedMotion}
          />
        </div>

        {/* Centered strike FX overlay */}
        {fxStyle && (
          <div className="pointer-events-none absolute inset-0 z-20">
            <StrikeFx active={true} style={fxStyle} dir={fxDir} reducedMotion={reducedMotion} />
          </div>
        )}

        {/* Damage floats */}
        <div className="pointer-events-none absolute inset-0 z-30">
          <DamageFloatLayer items={floats} />
        </div>

        {/* Dust on slam */}
        {dustAt && !reducedMotion && (
          <DustBurst key={dustAt.id} side={dustAt.side} />
        )}
      </div>
    </div>
  );
}

function FighterHud({
  name, hp, maxHp, critical, align, poisoned,
}: { name: string; hp: number; maxHp: number; critical: boolean; align: "left" | "right"; poisoned?: boolean }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="flex items-center gap-2 text-xs text-white/80 mb-1"
           style={{ flexDirection: align === "right" ? "row-reverse" : "row" }}>
        <Heart className="h-3 w-3 text-red-400" />
        <span className="font-semibold truncate max-w-[60%]">{name}</span>
        <span className="ml-auto tabular-nums text-white/60">{Math.max(0, Math.round(hp))}/{maxHp}</span>
      </div>
      <HpBar hp={hp} maxHp={maxHp} align={align} critical={critical} poisoned={poisoned} />
    </div>
  );
}

function CobwebPattern() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
      viewBox="0 0 200 200" preserveAspectRatio="none"
    >
      <defs>
        <pattern id="cobweb" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M0 0 L40 40 M40 0 L0 40 M20 0 L20 40 M0 20 L40 20"
                stroke="white" strokeWidth="0.4" fill="none" />
          <circle cx="20" cy="20" r="8" stroke="white" strokeWidth="0.4" fill="none" />
          <circle cx="20" cy="20" r="14" stroke="white" strokeWidth="0.4" fill="none" />
        </pattern>
      </defs>
      <rect width="200" height="200" fill="url(#cobweb)" />
    </svg>
  );
}

function DustBurst({ side }: { side: "me" | "opp" }) {
  const parts = Array.from({ length: 8 }, (_, i) => i);
  const baseX = side === "me" ? "30%" : "70%";
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {parts.map((i) => {
        const angle = (i / parts.length) * Math.PI * 2;
        const dx = Math.cos(angle) * 36;
        const dy = Math.sin(angle) * 24;
        return (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-amber-200/70"
            style={{
              left: baseX, top: "60%",
              animation: "dust-puff 0.55s ease-out forwards",
              transform: "translate(-50%,-50%)",
              // Use CSS variables read by inline style for end position.
              ["--dx" as any]: `${dx}px`,
              ["--dy" as any]: `${dy}px`,
            } as React.CSSProperties}
          />
        );
      })}
      <style>{`
        @keyframes dust-puff {
          0%   { opacity: 0;   transform: translate(-50%,-50%) scale(0.6); }
          30%  { opacity: 0.9; }
          100% { opacity: 0;   transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.1); }
        }
      `}</style>
    </div>
  );
}