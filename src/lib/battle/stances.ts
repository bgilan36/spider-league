import { Sword, Zap, Skull, Shield, Wind, RotateCcw, type LucideIcon } from "lucide-react";

export type AttackStance = "power_strike" | "quick_strike" | "venom_bite";
export type DefenseStance = "iron_web" | "evasive" | "counter_sting";
export type ZoneBucket = "miss" | "zone" | "perfect";

export interface StanceMeta {
  id: AttackStance | DefenseStance;
  label: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
}

export const ATTACK_STANCE_META: Record<AttackStance, StanceMeta> = {
  power_strike: {
    id: "power_strike",
    label: "Power Strike",
    tagline: "Wider crit window, +180% crit damage",
    description:
      "Crits trigger on dice ≥ 18 and hit 2.8× harder. Best when you can land the Skill Zone reliably.",
    icon: Sword,
  },
  quick_strike: {
    id: "quick_strike",
    label: "Quick Strike",
    tagline: "Perfect rolls trigger a follow-up hit",
    description:
      "On a Perfect timing lock, deal a bonus 60% damage strike. No crit bonus — reward for precision.",
    icon: Zap,
  },
  venom_bite: {
    id: "venom_bite",
    label: "Venom Bite",
    tagline: "Uses venom, ignores 30% of defense",
    description:
      "Damage scales off venom instead of damage stat and slips past most defense. Great vs tanky spiders.",
    icon: Skull,
  },
};

export const DEFENSE_STANCE_META: Record<DefenseStance, StanceMeta> = {
  iron_web: {
    id: "iron_web",
    label: "Iron Web",
    tagline: "+25% defense, can't dodge",
    description:
      "Soak hits with reinforced webbing. Best vs heavy attackers — but you can't fully evade.",
    icon: Shield,
  },
  evasive: {
    id: "evasive",
    label: "Evasive",
    tagline: "Dodge on defense dice ≥ 17",
    description:
      "Land your defense timing for a chance to fully avoid an incoming hit. Lower flat defense.",
    icon: Wind,
  },
  counter_sting: {
    id: "counter_sting",
    label: "Counter-Sting",
    tagline: "+20% damage on your next attack after taking a hit",
    description:
      "Every hit you absorb stores a counter rider that boosts your next attack roll.",
    icon: RotateCcw,
  },
};

export const ATTACK_STANCES = Object.values(ATTACK_STANCE_META);
export const DEFENSE_STANCES = Object.values(DEFENSE_STANCE_META);

export const BUCKET_LABEL: Record<ZoneBucket, string> = {
  miss: "Missed",
  zone: "Skill Zone",
  perfect: "Perfect!",
};
