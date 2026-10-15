// Pure, deterministic weekly tournament engine. No I/O here — tested in tournament-engine.test.ts.
import { STAT_KEYS, STAT_LABELS, TOURNAMENT, WILD_SPECIES, type StatKey } from "./tournament-config.ts";

export type Stats = Record<StatKey, number>;

export interface Participant {
  id: string;            // spider id, or deterministic id for Wild Challengers
  spider_id: string | null;
  owner_id: string | null;
  owner_name: string | null;
  name: string;
  species: string;
  image_url: string | null;
  power: number;         // effective power (veteran multiplier applied)
  stats: Stats;          // effective stats (veteran multiplier applied)
  is_wild: boolean;
  is_veteran: boolean;
  seed?: number;
}

export interface RoundResult {
  attribute: StatKey;
  a_value: number;   // normalized 0-100
  b_value: number;
  a_strength: number;
  b_strength: number;
  winner: "a" | "b";
}

export interface MatchResult {
  round_number: number;   // 1 = first round
  slot: number;           // 0-based position within the round
  a: string | null;       // participant ids (null = bye)
  b: string | null;
  winner: string;
  is_upset: boolean;
  rounds: RoundResult[];
  score: [number, number];
  commentary: string;
}

// ---------- RNG ----------
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function makeRng(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic UUID-shaped id from a string. */
export function stableUuid(key: string): string {
  const parts = [0, 1, 2, 3].map((i) => hashString(`${key}#${i}`).toString(16).padStart(8, "0")).join("");
  return `${parts.slice(0, 8)}-${parts.slice(8, 12)}-4${parts.slice(13, 16)}-a${parts.slice(17, 20)}-${parts.slice(20, 32)}`;
}

// ---------- Week calendar (America/Los_Angeles) ----------
function tzParts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(date)) p[x.type] = x.value;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second, dow };
}

/** UTC instant for a wall-clock time in tz. */
export function zonedToUtc(y: number, m: number, d: number, h: number, tz: string = TOURNAMENT.TIMEZONE): Date {
  let guess = Date.UTC(y, m - 1, d, h);
  for (let i = 0; i < 2; i++) {
    const p = tzParts(new Date(guess), tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    guess += Date.UTC(y, m - 1, d, h) - asUtc;
  }
  return new Date(guess);
}

export function localParts(date: Date) {
  return tzParts(date, TOURNAMENT.TIMEZONE);
}

/** ISO week id ("2026-W44") for a calendar date (y-m-d of the Monday). */
export function isoWeekId(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

/** The game week containing `now`: Monday 00:00 → Sunday LOCK_HOUR local. */
export function weekWindow(now: Date) {
  const p = localParts(now);
  const daysSinceMonday = (p.dow + 6) % 7;
  const mon = new Date(Date.UTC(p.y, p.m - 1, p.d - daysSinceMonday));
  const my = mon.getUTCFullYear(), mm = mon.getUTCMonth() + 1, md = mon.getUTCDate();
  const sun = new Date(Date.UTC(my, mm - 1, md + 6));
  const startsAt = zonedToUtc(my, mm, md, 0);
  const locksAt = zonedToUtc(sun.getUTCFullYear(), sun.getUTCMonth() + 1, sun.getUTCDate(), TOURNAMENT.LOCK_HOUR);
  return { id: isoWeekId(my, mm, md), startsAt, locksAt };
}

/** Week that should be open for entries at `now` (after Sunday lock, next week opens). */
export function openWeekFor(now: Date) {
  const w = weekWindow(now);
  if (now.getTime() >= w.locksAt.getTime()) {
    return weekWindow(new Date(w.startsAt.getTime() + 7.5 * 86400000));
  }
  return w;
}

/** Season = calendar month (local) of the lock date, e.g. "2026-10". */
export function seasonIdFor(locksAt: Date): string {
  const p = localParts(locksAt);
  return `${p.y}-${String(p.m).padStart(2, "0")}`;
}

/** True if the week locking at `locksAt` is the last lock of its month. */
export function isLastWeekOfSeason(locksAt: Date): boolean {
  return seasonIdFor(locksAt) !== seasonIdFor(new Date(locksAt.getTime() + 7 * 86400000));
}

export function weekLabel(startsAt: Date | string, displayName?: string | null): string {
  if (displayName) return displayName;
  const d = new Date(startsAt);
  const s = d.toLocaleDateString("en-US", { timeZone: TOURNAMENT.TIMEZONE, month: "short", day: "numeric" });
  return `Week of ${s}`;
}

// ---------- Stats helpers ----------
export function applyVeteran(stats: Stats, power: number) {
  const k = TOURNAMENT.VETERAN_MULTIPLIER;
  const out = {} as Stats;
  for (const key of STAT_KEYS) out[key] = Math.round(stats[key] * k);
  return { stats: out, power: Math.round(power * k) };
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Generate `count` Wild Challengers from a sample of real spiders' stats/power. */
export function makeWildChallengers(
  count: number,
  sample: { stats: Stats; power: number }[],
  seedKey: string,
): Participant[] {
  const rng = makeRng(`wild:${seedKey}`);
  const lo = TOURNAMENT.WILD_STAT_PERCENTILE_LOW, hi = TOURNAMENT.WILD_STAT_PERCENTILE_HIGH;
  const fallback = { stats: { hit_points: 60, damage: 40, speed: 40, defense: 40, venom: 40, webcraft: 40 }, power: 260 };
  const src = sample.length ? sample : [fallback];
  const ranges = {} as Record<StatKey | "power", [number, number]>;
  for (const key of STAT_KEYS) {
    const vals = src.map((s) => s.stats[key]).sort((a, b) => a - b);
    ranges[key] = [percentile(vals, lo), percentile(vals, hi)];
  }
  const pv = src.map((s) => s.power).sort((a, b) => a - b);
  ranges.power = [percentile(pv, lo), percentile(pv, hi)];

  const used = new Set<string>();
  const out: Participant[] = [];
  for (let i = 0; i < count; i++) {
    let species = WILD_SPECIES[Math.floor(rng() * WILD_SPECIES.length)];
    for (let t = 0; t < 5 && used.has(species); t++) species = WILD_SPECIES[Math.floor(rng() * WILD_SPECIES.length)];
    used.add(species);
    const stats = {} as Stats;
    for (const key of STAT_KEYS) {
      const [a, b] = ranges[key];
      stats[key] = Math.round(a + (b - a) * rng());
    }
    const [pa, pb] = ranges.power;
    out.push({
      id: stableUuid(`wild:${seedKey}:${i}`),
      spider_id: null, owner_id: null, owner_name: null,
      name: `Wild ${species}`, species, image_url: null,
      power: Math.round(pa + (pb - pa) * rng()),
      stats, is_wild: true, is_veteran: false,
    });
  }
  return out;
}

// ---------- Bracket construction ----------
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Bracket size for `realCount` entries with the given minimum. */
export function bracketSize(realCount: number, min: number): number {
  return nextPow2(Math.max(realCount, min));
}

/** Standard seed order for a bracket: size 4 -> [1,4,2,3]; pairs are (0,1),(2,3)... */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/**
 * Seeds participants by power and lays them into first-round slots.
 * Returns an array of length `size` (null = bye). Byes always go to top seeds.
 */
export function layoutBracket(participants: Participant[], size: number, avoidSameOwner: boolean): (Participant | null)[] {
  const seeded = [...participants]
    .sort((a, b) => b.power - a.power || a.id.localeCompare(b.id))
    .map((p, i) => ({ ...p, seed: i + 1 }));
  const bySeed = new Map(seeded.map((p) => [p.seed!, p]));
  const slots: (Participant | null)[] = seedOrder(size).map((s) => bySeed.get(s) ?? null);

  if (avoidSameOwner) {
    const pairs = size / 2;
    const sameOwner = (i: number) => {
      const a = slots[2 * i], b = slots[2 * i + 1];
      return !!a && !!b && !!a.owner_id && a.owner_id === b.owner_id;
    };
    for (let i = 0; i < pairs; i++) {
      if (!sameOwner(i)) continue;
      // Swap the lower seed (odd slot) with the lower seed of another pair, if that fixes both.
      for (let j = 0; j < pairs; j++) {
        if (j === i) continue;
        const x = 2 * i + 1, y = 2 * j + 1;
        if (!slots[x] || !slots[y]) continue;
        [slots[x], slots[y]] = [slots[y], slots[x]];
        if (!sameOwner(i) && !sameOwner(j)) break;
        [slots[x], slots[y]] = [slots[y], slots[x]];
      }
    }
  }
  return slots;
}

// ---------- Match simulation ----------
export interface Normalizer {
  stat: Record<StatKey, number>;
  power: number;
}

export function buildNormalizer(ps: Participant[]): Normalizer {
  const stat = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) stat[k] = Math.max(1, ...ps.map((p) => p.stats[k] ?? 0));
  return { stat, power: Math.max(1, ...ps.map((p) => p.power)) };
}

const norm = (v: number, max: number) => Math.max(0, Math.min(100, Math.round((v / max) * 1000) / 10));

export function roundWinProbability(a: number, b: number): number {
  const k = TOURNAMENT.WIN_EXPONENT;
  const ak = Math.pow(Math.max(a, 0.01), k), bk = Math.pow(Math.max(b, 0.01), k);
  return ak / (ak + bk);
}

export function simulateMatch(a: Participant, b: Participant, n: Normalizer, rngSeed: string) {
  const rng = makeRng(rngSeed);
  const pool = [...STAT_KEYS] as StatKey[];
  const rounds: RoundResult[] = [];
  let wa = 0, wb = 0;
  const pa = norm(a.power, n.power), pb = norm(b.power, n.power);
  while (wa < TOURNAMENT.ROUNDS_TO_WIN && wb < TOURNAMENT.ROUNDS_TO_WIN && rounds.length < TOURNAMENT.ROUNDS_PER_MATCH) {
    const idx = Math.floor(rng() * pool.length);
    const attribute = pool.splice(idx, 1)[0];
    const av = norm(a.stats[attribute], n.stat[attribute]);
    const bv = norm(b.stats[attribute], n.stat[attribute]);
    const as = av * TOURNAMENT.ATTRIBUTE_WEIGHT + pa * TOURNAMENT.POWER_WEIGHT;
    const bs = bv * TOURNAMENT.ATTRIBUTE_WEIGHT + pb * TOURNAMENT.POWER_WEIGHT;
    const winner = rng() < roundWinProbability(as, bs) ? "a" : "b";
    if (winner === "a") wa++; else wb++;
    rounds.push({ attribute, a_value: av, b_value: bv, a_strength: Math.round(as * 10) / 10, b_strength: Math.round(bs * 10) / 10, winner });
  }
  return { rounds, score: [wa, wb] as [number, number], winner: wa > wb ? a : b };
}

const TEMPLATES = [
  "{W}'s {attr} took round {r} to finish off {L} {s}.",
  "{W} leaned on {attr} and closed out {L} {s}.",
  "{attr} decided it: {W} over {L}, {s}.",
  "{L} had no answer for {W}'s {attr} in round {r} — {s}.",
];
const SWEEP_TEMPLATES = [
  "{W} swept {L} {s}, sealed with {attr}.",
  "Clean sweep: {W} rolled {L} {s} on {attr}.",
];
const UPSET_TEMPLATES = [
  "Upset! {W}'s {attr} toppled {L} {s}.",
  "Nobody saw it coming — {W} stunned {L} {s} with {attr}.",
];

export function commentaryFor(winner: Participant, loser: Participant, rounds: RoundResult[], score: [number, number], upset: boolean, seed: string): string {
  const rng = makeRng(`c:${seed}`);
  const last = rounds[rounds.length - 1];
  const s = `${Math.max(...score)}–${Math.min(...score)}`;
  const set = upset ? UPSET_TEMPLATES : Math.min(...score) === 0 ? SWEEP_TEMPLATES : TEMPLATES;
  const t = set[Math.floor(rng() * set.length)];
  const fill = t.replace("{W}", winner.name).replace("{L}", loser.name)
    .replace("{attr}", STAT_LABELS[last.attribute]).replace("{r}", String(rounds.length)).replace("{s}", s);
  return fill.charAt(0).toUpperCase() + fill.slice(1);
}

export interface BracketResult {
  participants: Participant[];
  matches: MatchResult[];
  champion: Participant;
  upset: MatchResult | null;
  size: number;
}

/** Simulates a full single-elimination bracket. Deterministic for a given seedKey + participants. */
export function simulateBracket(participants: Participant[], size: number, seedKey: string, avoidSameOwner: boolean): BracketResult {
  const slots = layoutBracket(participants, size, avoidSameOwner);
  const seeded = slots.filter(Boolean) as Participant[];
  const n = buildNormalizer(seeded);
  const matches: MatchResult[] = [];
  let current = slots;
  let round = 1;
  while (current.length > 1) {
    const next: (Participant | null)[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i], b = current[i + 1];
      const slot = i / 2;
      if (!a || !b) {
        const adv = a ?? b;
        next.push(adv);
        if (adv) matches.push({ round_number: round, slot, a: adv.id, b: null, winner: adv.id, is_upset: false, rounds: [], score: [0, 0], commentary: `${adv.name} advances with a bye.` });
        continue;
      }
      const key = `${seedKey}:r${round}s${slot}`;
      const sim = simulateMatch(a, b, n, key);
      const w = sim.winner, l = w === a ? b : a;
      const upset = (w.seed ?? 0) > (l.seed ?? 0);
      matches.push({
        round_number: round, slot, a: a.id, b: b.id, winner: w.id, is_upset: upset,
        rounds: sim.rounds, score: sim.score,
        commentary: commentaryFor(w, l, sim.rounds, sim.score, upset, key),
      });
      next.push(w);
    }
    current = next;
    round++;
  }
  const champion = current[0]!;
  const byId = new Map(seeded.map((p) => [p.id, p]));
  let upset: MatchResult | null = null;
  let gap = 0;
  for (const m of matches) {
    if (!m.is_upset || !m.b) continue;
    const g = Math.abs((byId.get(m.a!)!.seed ?? 0) - (byId.get(m.b)!.seed ?? 0));
    if (g > gap) { gap = g; upset = m; }
  }
  return { participants: seeded, matches, champion, upset, size };
}

/** How many rounds each participant won through (0 = lost first match). */
export function finishDepth(matches: MatchResult[]): Map<string, number> {
  const d = new Map<string, number>();
  for (const m of matches) {
    for (const id of [m.a, m.b]) if (id && !d.has(id)) d.set(id, 0);
    if (m.b) d.set(m.winner, Math.max(d.get(m.winner) ?? 0, m.round_number));
    else d.set(m.winner, Math.max(d.get(m.winner) ?? 0, m.round_number));
  }
  return d;
}

/** Season points per owner from one pod bracket. */
export function podPoints(result: BracketResult): Map<string, number> {
  const byId = new Map(result.participants.map((p) => [p.id, p]));
  const pts = new Map<string, number>();
  for (const m of result.matches) {
    if (!m.b) continue; // byes aren't match wins
    const owner = byId.get(m.winner)?.owner_id;
    if (owner) pts.set(owner, (pts.get(owner) ?? 0) + TOURNAMENT.POINTS_PER_MATCH_WIN);
  }
  const champOwner = result.champion.owner_id;
  if (champOwner) pts.set(champOwner, (pts.get(champOwner) ?? 0) + TOURNAMENT.POINTS_POD_CHAMPION);
  return pts;
}
