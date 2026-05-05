import { cn } from "@/lib/utils";

interface DiceDisplayProps {
  value: number;
  label?: string;
  variant?: "attack" | "defense";
  rolling?: boolean;
}

// Renders a d20-style die: a hexagonal badge with the number, plus pip dots
// around the edge to give a quick visual sense of high vs low rolls.
export default function DiceDisplay({ value, label, variant = "attack", rolling }: DiceDisplayProps) {
  const clamped = Math.max(1, Math.min(20, value || 0));
  const pips = Math.round((clamped / 20) * 12);
  const tone =
    clamped >= 18
      ? "from-yellow-400 to-amber-600 border-yellow-300 text-background"
      : clamped >= 11
        ? variant === "attack"
          ? "from-red-500 to-red-700 border-red-300 text-white"
          : "from-emerald-500 to-emerald-700 border-emerald-300 text-white"
        : "from-muted to-muted/60 border-border text-foreground";

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      )}
      <div
        className={cn(
          "relative w-16 h-16 rounded-xl border-2 bg-gradient-to-br shadow-lg flex items-center justify-center",
          tone,
          rolling && "animate-bounce",
        )}
        style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
        aria-label={`${label || "Dice"}: ${clamped} of 20`}
      >
        <span className="text-2xl font-black tabular-nums drop-shadow">{clamped}</span>
      </div>
      <div className="flex gap-[2px]" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              i < pips ? "bg-foreground" : "bg-muted",
            )}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">d20</span>
    </div>
  );
}
