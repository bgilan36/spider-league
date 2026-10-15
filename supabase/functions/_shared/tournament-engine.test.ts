import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  bracketSize, layoutBracket, makeWildChallengers, podPoints, roundWinProbability, seedOrder,
  simulateBracket, weekWindow, type Participant,
} from "./tournament-engine.ts";

const mk = (id: string, power: number, owner = id): Participant => ({
  id, spider_id: id, owner_id: owner, owner_name: owner, name: `S${id}`, species: "x", image_url: null,
  power, stats: { hit_points: power, damage: power, speed: power, defense: power, venom: power, webcraft: power },
  is_wild: false, is_veteran: false,
});

Deno.test("week runs Monday 00:00 to Sunday 17:00 Los Angeles", () => {
  const w = weekWindow(new Date("2026-10-28T20:00:00Z")); // Wed
  assertEquals(w.startsAt.toISOString(), "2026-10-26T07:00:00.000Z");
  assertEquals(w.locksAt.toISOString(), "2026-11-02T01:00:00.000Z"); // Sun 5pm PDT... Nov 1 is PST switch
  assertEquals(w.id, "2026-W44");
});

Deno.test("bracket sizes pad to min then next power of two", () => {
  assertEquals(bracketSize(3, 8), 8);
  assertEquals(bracketSize(9, 8), 16);
  assertEquals(bracketSize(10, 16), 16);
  assertEquals(bracketSize(17, 16), 32);
});

Deno.test("seed order pairs 1v16 and 8v9", () => {
  const o = seedOrder(16);
  assertEquals([o[0], o[1]], [1, 16]);
  assertEquals([o[2], o[3]], [8, 9]);
});

Deno.test("byes go to top seeds", () => {
  const ps = Array.from({ length: 6 }, (_, i) => mk(`p${i}`, 100 - i));
  const slots = layoutBracket(ps, 8, false);
  // seeds 1 and 2 face empty slots (7, 8)
  const pair = (s: number) => slots.findIndex((p) => p?.seed === s);
  assertEquals(slots[pair(1) ^ 1], null);
  assertEquals(slots[pair(2) ^ 1], null);
});

Deno.test("pods avoid same-owner first-round matchups when possible", () => {
  const ps = [mk("a", 100, "u1"), mk("b", 90, "u2"), mk("c", 80, "u2"), mk("d", 70, "u1")];
  const slots = layoutBracket(ps, 4, true);
  for (let i = 0; i < 4; i += 2) assert(slots[i]!.owner_id !== slots[i + 1]!.owner_id);
});

Deno.test("round win probability is a^3/(a^3+b^3)", () => {
  assertEquals(roundWinProbability(50, 50), 0.5);
  assertEquals(Math.round(roundWinProbability(80, 40) * 1000) / 1000, 0.889);
});

Deno.test("simulation is deterministic and best of 3", () => {
  const ps = Array.from({ length: 16 }, (_, i) => mk(`p${i}`, 400 - i * 10));
  const r1 = simulateBracket(ps, 16, "2026-W44:global", false);
  const r2 = simulateBracket(ps, 16, "2026-W44:global", false);
  assertEquals(r1.champion.id, r2.champion.id);
  assertEquals(JSON.stringify(r1.matches), JSON.stringify(r2.matches));
  assertEquals(r1.matches.length, 15);
  for (const m of r1.matches) {
    assert(m.rounds.length >= 2 && m.rounds.length <= 3);
    assertEquals(Math.max(...m.score), 2);
    assertEquals(new Set(m.rounds.map((r) => r.attribute)).size, m.rounds.length);
  }
});

Deno.test("wild challengers sit between the 25th and 60th percentile and are labelled Wild", () => {
  const sample = Array.from({ length: 20 }, (_, i) => ({ stats: mk("x", (i + 1) * 10).stats, power: (i + 1) * 10 }));
  const wild = makeWildChallengers(10, sample, "seed");
  for (const w of wild) {
    assert(w.name.startsWith("Wild "));
    assert(w.power >= 57 && w.power <= 124, `power ${w.power}`);
    assertEquals(w.owner_id, null);
  }
});

Deno.test("pod points: 1 per match win, +3 for the champion", () => {
  const ps = [mk("a", 400, "u1"), mk("b", 10, "u2")];
  const r = simulateBracket(ps, 2, "k", false);
  const pts = podPoints(r);
  assertEquals(pts.get(r.champion.owner_id!), 4);
});
