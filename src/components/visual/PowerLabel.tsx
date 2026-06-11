import * as React from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface Props {
  value: number | string;
  /** Visual size */
  size?: "sm" | "md" | "lg" | "xl";
  /** Hide the "Power" word, show only "⚡ 404" */
  iconOnly?: boolean;
  className?: string;
}

const SIZES: Record<NonNullable<Props["size"]>, { num: string; icon: string; label: string }> = {
  sm: { num: "text-sm",  icon: "h-3 w-3",   label: "text-[10px]" },
  md: { num: "text-base",icon: "h-3.5 w-3.5", label: "text-xs"   },
  lg: { num: "text-2xl", icon: "h-5 w-5",   label: "text-xs"     },
  xl: { num: "text-4xl", icon: "h-7 w-7",   label: "text-xs"     },
};

/**
 * Canonical "⚡ Power" display. Use everywhere — no more
 * "Power Score" / "Total Power Score" / "Power + XP" variants.
 */
const PowerLabel: React.FC<Props> = ({
  value,
  size = "md",
  iconOnly = false,
  className,
}) => {
  const s = SIZES[size];
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-baseline gap-1 font-display tabular-nums leading-none",
              className,
            )}
            aria-label={`Power ${value}`}
          >
            <Zap
              aria-hidden
              className={cn(s.icon, "text-yellow-400 self-center -translate-y-[1px]")}
              fill="currentColor"
            />
            <span className={cn("font-bold text-foreground", s.num)}>{value}</span>
            {!iconOnly && (
              <span className={cn("meta-label", s.label)}>Power</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p className="font-medium mb-1">Power</p>
          <p className="text-muted-foreground">
            Combined battle rating from all six stats (HP, Damage, Speed,
            Defense, Venom, Webcraft), plus level bonus. Higher is stronger.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default PowerLabel;