// Deterministic seeded PRNG + interactive battle damage math.
// Used by edge functions battle-start, battle-turn, battle-opponent-turn so the
// same seed always produces the same dice for a given turn index.

export type AttackStance = "power_strike" | "quick_strike" | "venom_bite";
export type DefenseStance = "iron_web" | "evasive" | "counter_sting";
export type ZoneBucket = "miss" | "zone" | "perfect";

export interface SpiderLite {
  id: string;
  nickname: string;
  damage: number;
  defense: number;
  venom: number;
  hit_points: number;
  power_score: number;
  speed: number;
}

export interface TurnInputs {
  seed: string;
  turnIndex: number;
  attacker: SpiderLite;
  defender: SpiderLite;
  attackStance: AttackStance;
  defenseStance: DefenseStance;
  attackerBucket: ZoneBucket;
  defenderBucket: ZoneBucket;
  attackerHasCounterRider?: boolean;
}

export interface TurnResult {
  attackerDice: number;
  defenderDice: number;
  damage: number;
  isCritical: boolean;
  dodged: boolean;
  bonusDamage: number;
  defenderEarnsCounterRider: boolean;
  breakdown: string[];
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function diceFor(seed: string, turnIndex: number, role: "atk" | "def"): number {
  const rng = mulberry32(hashString(`${seed}:${turnIndex}:${role}`));
  return Math.floor(rng() * 20) + 1;
}

function applyBucket(
  raw: number,
  bucket: ZoneBucket,
  role: "atk" | "def",
  seed: string,
  turnIndex: number,
): number {
  if (bucket === "perfect") {
    const rng = mulberry32(hashString(`${seed}:${turnIndex}:${role}:perfect`));
    return 18 + Math.floor(rng() * 3);
  }
  if (bucket === "zone") {
    const floor = role === "atk" ? 8 : 6;
    return Math.max(floor, raw);
  }
  return Math.max(1, raw - 2);
}

export function underdogZoneBoost(player: SpiderLite, opponent: SpiderLite): number {
  if (opponent.power_score <= player.power_score) return 0;
  const gap = (opponent.power_score - player.power_score) / Math.max(1, player.power_score);
  return Math.min(0.5, gap);
}

export function resolveTurn(input: TurnInputs): TurnResult {
  const breakdown: string[] = [];
  const rawAtk = diceFor(input.seed, input.turnIndex, "atk");
  const rawDef = diceFor(input.seed, input.turnIndex, "def");
  const attackerDice = applyBucket(rawAtk, input.attackerBucket, "atk", input.seed, input.turnIndex);
  const defenderDice = applyBucket(rawDef, input.defenderBucket, "def", input.seed, input.turnIndex);
  breakdown.push(`Attack die: ${attackerDice} (${input.attackerBucket})`);
  breakdown.push(`Defense die: ${defenderDice} (${input.defenderBucket})`);

  const useVenom = input.attackStance === "venom_bite";
  const atkStat = useVenom ? input.attacker.venom : input.attacker.damage;
  const statMultiplier = useVenom ? 2.0 : 1.8;
  const baseDamage = Math.floor(atkStat * statMultiplier) + (attackerDice - 10);
  breakdown.push(`Base from ${useVenom ? "venom" : "damage"}: ${baseDamage}`);

  let defense = Math.floor(input.defender.defense / (useVenom ? 15 : 18));
  if (input.defenseStance === "iron_web") {
    defense = Math.floor(defense * 1.25);
    breakdown.push(`Iron Web defense +25%`);
  }
  if (defenderDice >= 18) defense += 2;
  if (useVenom) defense = Math.floor(defense * 0.7);

  let dodged = false;
  if (input.defenseStance === "evasive" && defenderDice >= 17 && attackerDice < 19) {
    dodged = true;
    breakdown.push(`Evasive dodge!`);
  }

  const critThreshold = input.attackStance === "power_strike" ? 18 : 19;
  let isCritical = false;
  let damage = 0;
  if (!dodged) {
    damage = Math.max(useVenom ? 8 : 5, baseDamage - defense);
    if (attackerDice >= critThreshold) {
      const critMult = input.attackStance === "power_strike" ? 2.8 : 2.3;
      damage = Math.floor(damage * critMult);
      isCritical = true;
      breakdown.push(`Critical hit x${critMult}`);
    }
  }

  if (!dodged && input.attackerHasCounterRider) {
    damage = Math.floor(damage * 1.2);
    breakdown.push(`Counter-Sting rider +20%`);
  }

  let bonusDamage = 0;
  if (
    !dodged
    && input.attackStance === "quick_strike"
    && input.attackerBucket === "perfect"
  ) {
    bonusDamage = Math.floor((useVenom ? input.attacker.venom : input.attacker.damage) * 0.6);
    breakdown.push(`Quick Strike follow-up +${bonusDamage}`);
  }

  const defenderEarnsCounterRider =
    !dodged && damage + bonusDamage > 0 && input.defenseStance === "counter_sting";

  return {
    attackerDice,
    defenderDice,
    damage: damage + bonusDamage,
    isCritical,
    dodged,
    bonusDamage,
    defenderEarnsCounterRider,
    breakdown,
  };
}

export function pickAiBucket(
  opponent: SpiderLite,
  player: SpiderLite,
  seed: string,
  turnIndex: number,
  role: "atk" | "def",
): ZoneBucket {
  const ratio = opponent.power_score / Math.max(1, player.power_score);
  const skill = Math.max(0.35, Math.min(0.9, 0.5 + (ratio - 1) * 0.4));
  const rng = mulberry32(hashString(`${seed}:ai:${turnIndex}:${role}`));
  const r = rng();
  const perfectChance = (skill * skill) / 5;
  if (r < perfectChance) return "perfect";
  if (r < skill) return "zone";
  return "miss";
}

export const MAX_TURNS = 12;
export const MIN_TURNS = 4;

export const ATTACK_STANCES: AttackStance[] = ["power_strike", "quick_strike", "venom_bite"];
export const DEFENSE_STANCES: DefenseStance[] = ["iron_web", "evasive", "counter_sting"];

export function isAttackStance(s: unknown): s is AttackStance {
  return typeof s === "string" && (ATTACK_STANCES as string[]).includes(s);
}
export function isDefenseStance(s: unknown): s is DefenseStance {
  return typeof s === "string" && (DEFENSE_STANCES as string[]).includes(s);
}
export function isBucket(s: unknown): s is ZoneBucket {
  return s === "miss" || s === "zone" || s === "perfect";
}
