import * as React from "react";
import { cn } from "@/lib/utils";
import { Heart, Sword, Zap, Shield, Skull, Activity, type LucideIcon } from "lucide-react";

export type StatKey =
  | "hp"
  | "damage"
  | "speed"
  | "defense"
  | "venom"
  | "webcraft";

const META: Record<
  StatKey,
  { label: string; cssVar: string; Icon: LucideIcon }
> = {
  hp:       { label: "HP",       cssVar: "stat-hp",       Icon: Heart    },
  damage:   { label: "Damage",   cssVar: "stat-damage",   Icon: Sword    },
  speed:    { label: "Speed",    cssVar: "stat-speed",    Icon: Zap      },
  defense:  { label: "Defense",  cssVar: "stat-defense",  Icon: Shield   },
  venom:    { label: "Venom",    cssVar: "stat-venom",    Icon: Skull    },
  webcraft: { label: "Webcraft", cssVar: "stat-webcraft", Icon: Activity },
};

interface Props {
  stat: StatKey;
  value: number;
  max?: number;
  /** Animation delay in ms — stagger bars when opening a modal */
  delay?: number;
  className?: string;
}

/** Color-coded, icon-prefixed, animated stat bar. Fills on mount. */
const StatBar: React.FC<Props> = ({ stat, value, max = 100, delay = 0, className }) => {
  const meta = META[stat];
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const Icon = meta.Icon;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <span className="meta-label flex items-center gap-1.5">
          <Icon
            className="h-3 w-3"
            style={{ color: `hsl(var(--${meta.cssVar}))` }}
          />
          {meta.label}
        </span>
        <span
          className="font-display text-sm tabular-nums"
          style={{ color: `hsl(var(--${meta.cssVar}))` }}
        >
          {value}
          <span className="text-muted-foreground text-[10px] ml-0.5">/{max}</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className="absolute inset-y-0 left-0 rounded-full animate-stat-fill"
          style={{
            ["--stat-target" as any]: `${pct}%`,
            background: `linear-gradient(90deg, hsl(var(--${meta.cssVar}) / 0.6), hsl(var(--${meta.cssVar})))`,
            boxShadow: `0 0 8px hsl(var(--${meta.cssVar}) / 0.45)`,
            animationDelay: `${delay}ms`,
          }}
        />
      </div>
    </div>
  );
};

export default StatBar;