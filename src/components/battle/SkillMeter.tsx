import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ZoneBucket } from "@/lib/battle/stances";

interface SkillMeterProps {
  label: string;
  helper?: string;
  zoneBoost?: number;
  disabled?: boolean;
  onLock: (bucket: ZoneBucket) => void;
}

const BAR_WIDTH = 320;
const SWEEP_MS = 1400;

export default function SkillMeter({ label, helper, zoneBoost = 0, disabled, onLock }: SkillMeterProps) {
  const [running, setRunning] = useState(false);
  const [pos, setPos] = useState(0);
  const [locked, setLocked] = useState<ZoneBucket | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const posRef = useRef(0);

  const zoneWidth = Math.min(0.55, 0.25 + zoneBoost);
  const zoneStart = 0.5 - zoneWidth / 2;
  const zoneEnd = 0.5 + zoneWidth / 2;
  const perfectStart = 0.5 - 0.03;
  const perfectEnd = 0.5 + 0.03;

  useEffect(() => {
    if (!running) return;
    const tick = (t: number) => {
      if (!startRef.current) startRef.current = t;
      const elapsed = (t - startRef.current) % SWEEP_MS;
      const half = SWEEP_MS / 2;
      const p = elapsed < half ? elapsed / half : 1 - (elapsed - half) / half;
      posRef.current = p;
      setPos(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = 0;
    };
  }, [running]);

  const handleStart = () => {
    setLocked(null);
    setRunning(true);
  };

  const handleLock = useCallback(() => {
    if (!running || disabled) return;
    setRunning(false);
    const p = posRef.current;
    let bucket: ZoneBucket = "miss";
    if (p >= perfectStart && p <= perfectEnd) bucket = "perfect";
    else if (p >= zoneStart && p <= zoneEnd) bucket = "zone";
    setLocked(bucket);
    window.setTimeout(() => onLock(bucket), 280);
  }, [running, disabled, perfectStart, perfectEnd, zoneStart, zoneEnd, onLock]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!running && !locked) handleStart();
        else if (running) handleLock();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, locked, handleLock]);

  return (
    <div className="w-full max-w-md mx-auto select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        {locked && (
          <div className={cn(
            "text-xs font-bold",
            locked === "perfect" && "text-yellow-400",
            locked === "zone" && "text-emerald-400",
            locked === "miss" && "text-red-400",
          )}>
            {locked === "perfect" ? "Perfect!" : locked === "zone" ? "Skill Zone" : "Missed"}
          </div>
        )}
      </div>

      <div className="relative h-10 rounded-full bg-muted/40 border border-border overflow-hidden mx-auto" style={{ maxWidth: BAR_WIDTH }}>
        <div className="absolute inset-y-0 bg-emerald-500/30" style={{ left: `${zoneStart * 100}%`, width: `${(zoneEnd - zoneStart) * 100}%` }} />
        <div className="absolute inset-y-0 bg-yellow-400/60" style={{ left: `${perfectStart * 100}%`, width: `${(perfectEnd - perfectStart) * 100}%` }} />
        <div className="absolute top-0 bottom-0 w-1 bg-foreground" style={{ left: `calc(${pos * 100}% - 2px)` }} />
      </div>

      {helper && <p className="text-xs text-muted-foreground mt-2 text-center">{helper}</p>}
      {zoneBoost > 0 && (
        <p className="text-xs text-emerald-400 mt-1 text-center">Underdog assist: Skill Zone widened</p>
      )}

      <div className="flex gap-2 mt-3 justify-center">
        {!running && !locked && (
          <Button onClick={handleStart} disabled={disabled} size="lg">Roll</Button>
        )}
        {running && (
          <Button onClick={handleLock} disabled={disabled} size="lg">Lock</Button>
        )}
      </div>
      {!locked && <p className="text-[10px] text-muted-foreground text-center mt-1">Tip: spacebar rolls / locks</p>}
    </div>
  );
}
