import { useEffect, useRef, useState } from "react";

interface Props {
  hp: number;
  maxHp: number;
  align?: "left" | "right";
  /** When true, bar pulses (heartbeat) — used when either side <=25% HP. */
  critical?: boolean;
  /** Optional poison tick overlay (ticks down a sliver). */
  poisoned?: boolean;
}

/**
 * Front bar tweens immediately; a ghost back-bar lags ~250ms behind
 * so the player can see the sliver of damage taken on each hit.
 */
export default function HpBar({ hp, maxHp, align = "left", critical, poisoned }: Props) {
  const safeMax = Math.max(1, maxHp);
  const pct = Math.max(0, Math.min(100, (hp / safeMax) * 100));

  const [ghostPct, setGhostPct] = useState(pct);
  const lastChange = useRef<number>(Date.now());

  useEffect(() => {
    lastChange.current = Date.now();
    const t = setTimeout(() => setGhostPct(pct), 280);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="w-full">
      <div
        className={
          "relative h-2.5 w-full rounded-full bg-muted/60 overflow-hidden " +
          (critical ? "animate-heartbeat origin-center" : "")
        }
      >
        {/* Ghost (delayed) bar — shows recent damage as a fading sliver */}
        <div
          className="absolute inset-y-0 bg-red-400/50 transition-[width] ease-out"
          style={{
            width: `${ghostPct}%`,
            transitionDuration: "650ms",
            [align === "right" ? "right" : "left"]: 0,
          } as React.CSSProperties}
        />
        {/* Front bar — instant feedback */}
        <div
          className={
            "absolute inset-y-0 transition-[width] ease-out " +
            (pct > 50
              ? "bg-emerald-500"
              : pct > 25
                ? "bg-yellow-400"
                : "bg-red-500")
          }
          style={{
            width: `${pct}%`,
            transitionDuration: "450ms",
            [align === "right" ? "right" : "left"]: 0,
          } as React.CSSProperties}
        />
        {poisoned && (
          <div
            className="absolute inset-0 pointer-events-none animate-pulse"
            style={{ background: "linear-gradient(90deg, rgba(34,197,94,0.0), rgba(34,197,94,0.35), rgba(34,197,94,0.0))" }}
          />
        )}
      </div>
    </div>
  );
}