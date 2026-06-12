import * as React from "react";
import { cn } from "@/lib/utils";
import { normalizeRarity, rarityFrameStyle, type RarityTier } from "@/lib/rarity";

interface Props {
  src: string;
  alt: string;
  rarity?: string | RarityTier | null;
  /** Tailwind size override; defaults to full-width square */
  className?: string;
  /** Disable rarity frame entirely (e.g. tiny avatars) */
  unframed?: boolean;
}

/**
 * Unified spider photo treatment.
 * Square, vignetted, mild contrast/sat boost, rarity-colored frame,
 * soft inner shadow so the photo feels mounted, not pasted.
 * Legendary tier additionally gets an animated shimmer border.
 */
const SpiderPhoto: React.FC<Props> = ({
  src,
  alt,
  rarity,
  className,
  unframed,
}) => {
  const tier = normalizeRarity(rarity as string | null | undefined);
  return (
    <div
      className={cn(
        "spider-photo",
        !unframed && "rarity-frame",
        !unframed && tier === "EPIC" && "rarity-epic-shimmer",
        !unframed && tier === "LEGENDARY" && "rarity-legendary-shimmer",
        !unframed && tier === "LEGENDARY" && "rarity-legendary-glow",
        className,
      )}
      style={unframed ? undefined : rarityFrameStyle(tier)}
    >
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
};

export default SpiderPhoto;