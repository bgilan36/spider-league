/**
 * Pure scoring + pairing engine for weekly head-to-head matchups.
 * No Supabase imports — fully unit-testable in Deno.
 */

export interface PlayerInput {
  userId: string;
  power: number;          // top spider power_score (or roster avg)
  elo: number;            // profiles.rating_elo
  weeklyWins: number;     // wins this week
  weeklyLosses: number;   // losses this week
  seasonWins: number;     // season wins (for rivalry boost)
  lastActiveAt: number;   // epoch ms — used for bye selection
}

export interface HistoryEntry {
  userA: string;
  userB: string;
  weeksAgo: number; // 0 = current week, 1 = last week, etc.
}

export interface Pairing {
  userA: string;
  userB: string;
  score: number;
}

export interface PairingResult {
  pairings: Pairing[];
  bye: string | null;
}

export const WEIGHTS = {
  power: 0.35,
  elo: 0.30,
  record: 0.20,
  rematch: 0.15,
} as const;

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Score in [0,1]. Higher = more fair/engaging pairing. */
export function scoreCandidate(
  a: PlayerInput,
  b: PlayerInput,
  history: HistoryEntry[],
): number {
  // 1. Power closeness
  const maxPower = Math.max(a.power, b.power, 1);
  const powerScore = 1 - Math.abs(a.power - b.power) / maxPower;

  // 2. ELO closeness (capped at 400 points apart)
  const eloDiff = Math.min(Math.abs(a.elo - b.elo), 400);
  const eloScore = 1 - eloDiff / 400;

  // 3. Record similarity (Swiss-style)
  const recA = a.weeklyWins - a.weeklyLosses;
  const recB = b.weeklyWins - b.weeklyLosses;
  const recordDiff = Math.min(Math.abs(recA - recB), 6);
  const recordScore = 1 - recordDiff / 6;

  // 4. Rematch penalty
  const key = pairKey(a.userId, b.userId);
  const recent = history.find(
    (h) => pairKey(h.userA, h.userB) === key,
  );
  let rematchScore = 1;
  if (recent) {
    if (recent.weeksAgo <= 2) rematchScore = 0;          // hard penalty
    else if (recent.weeksAgo <= 4) rematchScore = 0.4;   // soft penalty
    else rematchScore = 0.75;
  }

  const base =
    WEIGHTS.power * powerScore +
    WEIGHTS.elo * eloScore +
    WEIGHTS.record * recordScore +
    WEIGHTS.rematch * rematchScore;

  // Rivalry boost: within 1 season-win of each other → small narrative bump
  const rivalry = Math.abs(a.seasonWins - b.seasonWins) <= 1 ? 0.03 : 0;

  return Math.max(0, Math.min(1, base + rivalry));
}

/**
 * Pair players to maximize total fairness score.
 * Greedy seed + one local-swap pass over all pair-pair combinations.
 */
export function buildPairings(
  players: PlayerInput[],
  history: HistoryEntry[],
): PairingResult {
  if (players.length < 2) {
    return { pairings: [], bye: players[0]?.userId ?? null };
  }

  let pool = [...players];
  let bye: string | null = null;

  // Odd count → lowest-activity player gets the bye
  if (pool.length % 2 === 1) {
    pool.sort((x, y) => x.lastActiveAt - y.lastActiveAt);
    bye = pool.shift()!.userId;
  }

  // Precompute all candidate scores
  const byId = new Map(pool.map((p) => [p.userId, p]));
  type Cand = { a: string; b: string; score: number };
  const candidates: Cand[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      candidates.push({
        a: pool[i].userId,
        b: pool[j].userId,
        score: scoreCandidate(pool[i], pool[j], history),
      });
    }
  }
  candidates.sort((x, y) => y.score - x.score);

  // Greedy seed
  const used = new Set<string>();
  const pairings: Pairing[] = [];
  for (const c of candidates) {
    if (used.has(c.a) || used.has(c.b)) continue;
    pairings.push({ userA: c.a, userB: c.b, score: c.score });
    used.add(c.a);
    used.add(c.b);
    if (pairings.length * 2 === pool.length) break;
  }

  // Local swap pass: try (A,B)+(C,D) → (A,C)+(B,D) and (A,D)+(B,C)
  const rescore = (x: string, y: string) =>
    scoreCandidate(byId.get(x)!, byId.get(y)!, history);

  let improved = true;
  let safety = 0;
  while (improved && safety++ < 4) {
    improved = false;
    for (let i = 0; i < pairings.length; i++) {
      for (let j = i + 1; j < pairings.length; j++) {
        const p1 = pairings[i];
        const p2 = pairings[j];
        const cur = p1.score + p2.score;
        const swap1A = rescore(p1.userA, p2.userA);
        const swap1B = rescore(p1.userB, p2.userB);
        const swap2A = rescore(p1.userA, p2.userB);
        const swap2B = rescore(p1.userB, p2.userA);
        if (swap1A + swap1B > cur + 1e-9 && swap1A + swap1B >= swap2A + swap2B) {
          pairings[i] = { userA: p1.userA, userB: p2.userA, score: swap1A };
          pairings[j] = { userA: p1.userB, userB: p2.userB, score: swap1B };
          improved = true;
        } else if (swap2A + swap2B > cur + 1e-9) {
          pairings[i] = { userA: p1.userA, userB: p2.userB, score: swap2A };
          pairings[j] = { userA: p1.userB, userB: p2.userA, score: swap2B };
          improved = true;
        }
      }
    }
  }

  return { pairings, bye };
}