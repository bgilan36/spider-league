import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedHpBarProps {
  current: number;
  max: number;
  damageThisTurn?: number;
  className?: string;
  duration?: number; // ms
  onTweenValueChange?: (value: number) => void;
}

/**
 * HP bar that smoothly tweens both the numeric HP value and the bar fill.
 * The visual drop and the displayed HP delta exactly match the per-turn
 * damage value passed in.
 */
export function AnimatedHpBar({
  current,
  max,
  damageThisTurn = 0,
  className,
  duration = 900,
  onTweenValueChange,
}: AnimatedHpBarProps) {
  const [tweenedHp, setTweenedHp] = useState(current);
  const fromRef = useRef(current);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = current;
    if (from === to) {
      setTweenedHp(to);
      onTweenValueChange?.(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic for a punchy, decelerating drop
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      setTweenedHp(value);
      onTweenValueChange?.(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [current, duration, onTweenValueChange]);

  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (tweenedHp / safeMax) * 100));
  const prevPct = Math.max(
    pct,
    Math.min(100, ((tweenedHp + (damageThisTurn || 0)) / safeMax) * 100)
  );
  const ghostWidth = Math.max(0, prevPct - pct);

  // Color shifts as HP drops
  const fillClass =
    pct > 60
      ? "bg-emerald-500"
      : pct > 30
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
        {/* Ghost trail showing the chunk that was just lost */}
        {damageThisTurn > 0 && ghostWidth > 0 && (
          <div
            className="absolute inset-y-0 bg-red-500/40 animate-pulse"
            style={{
              left: `${pct}%`,
              width: `${ghostWidth}%`,
              transition: `left ${duration}ms cubic-bezier(0.22, 1, 0.36, 1), width ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          />
        )}
        {/* Main fill */}
        <div
          className={cn("h-full rounded-full", fillClass)}
          style={{
            width: `${pct}%`,
            transition: `width ${duration}ms cubic-bezier(0.22, 1, 0.36, 1), background-color 300ms ease`,
          }}
        />
      </div>
    </div>
  );
}

export function getRoundedHp(value: number) {
  return Math.max(0, Math.round(value));
}
