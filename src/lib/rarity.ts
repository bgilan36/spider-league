/**
 * Single source of truth for spider rarity tiers.
 * Tier colors live as CSS vars (--rarity-*) and Tailwind tokens (rarity.*).
 */

export type RarityTier =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

export interface RarityMeta {
  tier: RarityTier;
  label: string;
  /** CSS variable name (without the `--`) — use as `hsl(var(--rarity-common))` */
  cssVar: string;
  /** Tailwind text class */
  text: string;
  /** Tailwind background class */
  bg: string;
  /** Tailwind ring class */
  ring: string;
  /** Tailwind border class */
  border: string;
}

export const RARITY: Record<RarityTier, RarityMeta> = {
  COMMON: {
    tier: "COMMON",
    label: "Common",
    cssVar: "rarity-common",
    text: "text-rarity-common",
    bg: "bg-rarity-common",
    ring: "ring-rarity-common",
    border: "border-rarity-common",
  },
  UNCOMMON: {
    tier: "UNCOMMON",
    label: "Uncommon",
    cssVar: "rarity-uncommon",
    text: "text-rarity-uncommon",
    bg: "bg-rarity-uncommon",
    ring: "ring-rarity-uncommon",
    border: "border-rarity-uncommon",
  },
  RARE: {
    tier: "RARE",
    label: "Rare",
    cssVar: "rarity-rare",
    text: "text-rarity-rare",
    bg: "bg-rarity-rare",
    ring: "ring-rarity-rare",
    border: "border-rarity-rare",
  },
  EPIC: {
    tier: "EPIC",
    label: "Epic",
    cssVar: "rarity-epic",
    text: "text-rarity-epic",
    bg: "bg-rarity-epic",
    ring: "ring-rarity-epic",
    border: "border-rarity-epic",
  },
  LEGENDARY: {
    tier: "LEGENDARY",
    label: "Legendary",
    cssVar: "rarity-legendary",
    text: "text-rarity-legendary",
    bg: "bg-rarity-legendary",
    ring: "ring-rarity-legendary",
    border: "border-rarity-legendary",
  },
};

/** Accepts any casing, returns canonical tier (defaults to COMMON). */
export function normalizeRarity(input?: string | null): RarityTier {
  if (!input) return "COMMON";
  const up = input.toUpperCase();
  if (up in RARITY) return up as RarityTier;
  return "COMMON";
}

export function rarityMeta(input?: string | null): RarityMeta {
  return RARITY[normalizeRarity(input)];
}

/**
 * Inline style for elements that want to read the active tier via CSS var
 * (used by the .rarity-frame utility).
 */
export function rarityFrameStyle(
  input?: string | null,
): React.CSSProperties {
  return {
    ["--rarity-tier" as any]: `var(--${rarityMeta(input).cssVar})`,
  };
}

/** Tier inferred from raw power score — used when no explicit rarity exists. */
export function rarityFromPower(power: number): RarityTier {
  if (power >= 700) return "LEGENDARY";
  if (power >= 550) return "EPIC";
  if (power >= 400) return "RARE";
  if (power >= 250) return "UNCOMMON";
  return "COMMON";
}

import type React from "react";