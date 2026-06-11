import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { normalizeRarity, rarityMeta } from "@/lib/rarity";

interface Props {
  rarity?: string | null;
  className?: string;
}

/** Standardized rarity badge — tier-colored, uppercase, tracked. */
const RarityBadge: React.FC<Props> = ({ rarity, className }) => {
  const meta = rarityMeta(rarity);
  const isLegendary = normalizeRarity(rarity) === "LEGENDARY";
  return (
    <Badge
      className={cn(
        "font-display text-[11px] tracking-[0.14em] uppercase px-2 py-0.5 border-transparent text-white",
        meta.bg,
        isLegendary && "shadow-[0_0_12px_hsl(var(--rarity-legendary)/0.55)]",
        className,
      )}
    >
      {meta.label}
    </Badge>
  );
};

export default RarityBadge;