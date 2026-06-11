import { useEffect, useState } from "react";

export type AttackStyle = "fang" | "web" | "blur" | "slam";

export interface CombatStats {
  damage?: number;
  speed?: number;
  venom?: number;
  webcraft?: number;
}

/** Highest stat dictates the attack style. Ties: venom > webcraft > speed > damage. */
export function pickAttackStyle(stats: CombatStats): AttackStyle {
  const order: { k: keyof CombatStats; style: AttackStyle }[] = [
    { k: "venom",    style: "fang" },
    { k: "webcraft", style: "web"  },
    { k: "speed",    style: "blur" },
    { k: "damage",   style: "slam" },
  ];
  let best: AttackStyle = "slam";
  let bestVal = -Infinity;
  for (const { k, style } of order) {
    const v = (stats[k] ?? 0) as number;
    if (v > bestVal) { bestVal = v; best = style; }
  }
  return best;
}

/** Single source of truth for combat motion timing. */
export const TIMING = {
  lunge: 220,
  strike: 180,
  recoil: 280,
  snapBack: 260,
  hpDrain: 500,
  ghostDelay: 250,
  baseTotal: 850,
  critExtra: 350,
  dodgeTotal: 520,
  finisher: 1400,
};

/** Reduced-motion preference. Returns true to disable rich motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/** Combat event consumed by the stage. */
export interface CombatEvent {
  attacker: "me" | "opp";
  damage: number;
  crit?: boolean;
  dodged?: boolean;
  style?: AttackStyle;   // override; otherwise derived from attacker stats
  finisher?: boolean;    // killing blow
  newAttackerHp?: number;
  newDefenderHp?: number;
}

/** Stub for future SFX hooks. */
export function playSfx(_name: string) { /* no-op */ }