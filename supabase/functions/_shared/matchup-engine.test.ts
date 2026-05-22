import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildPairings,
  scoreCandidate,
  type HistoryEntry,
  type PlayerInput,
} from "./matchup-engine.ts";

const mk = (overrides: Partial<PlayerInput> & { userId: string }): PlayerInput => ({
  power: 100,
  elo: 1000,
  weeklyWins: 0,
  weeklyLosses: 0,
  seasonWins: 0,
  lastActiveAt: Date.now(),
  ...overrides,
});

Deno.test("scoreCandidate: closer power scores higher", () => {
  const a = mk({ userId: "a", power: 100 });
  const near = mk({ userId: "b", power: 105 });
  const far = mk({ userId: "c", power: 200 });
  assert(scoreCandidate(a, near, []) > scoreCandidate(a, far, []));
});

Deno.test("scoreCandidate: recent rematch hard-penalized", () => {
  const a = mk({ userId: "a" });
  const b = mk({ userId: "b" });
  const history: HistoryEntry[] = [{ userA: "a", userB: "b", weeksAgo: 1 }];
  const withRematch = scoreCandidate(a, b, history);
  const fresh = scoreCandidate(a, b, []);
  assert(fresh - withRematch > 0.1, "rematch should drop score meaningfully");
});

Deno.test("buildPairings: odd count gives bye to least-active player", () => {
  const now = Date.now();
  const players = [
    mk({ userId: "active", lastActiveAt: now }),
    mk({ userId: "mid", lastActiveAt: now - 1000 }),
    mk({ userId: "stale", lastActiveAt: now - 999_999 }),
  ];
  const result = buildPairings(players, []);
  assertEquals(result.bye, "stale");
  assertEquals(result.pairings.length, 1);
});

Deno.test("buildPairings: swap pass beats naive greedy on adversarial input", () => {
  // Four similarly-skilled players; greedy by power would pair (a-b)+(c-d).
  // Both pairs played last week, so the engine should swap to avoid double rematch.
  const players = [
    mk({ userId: "a", power: 100, elo: 1000 }),
    mk({ userId: "b", power: 102, elo: 1010 }),
    mk({ userId: "c", power: 105, elo: 1020 }),
    mk({ userId: "d", power: 108, elo: 1030 }),
  ];
  const result = buildPairings(players, [
    { userA: "a", userB: "b", weeksAgo: 1 },
    { userA: "c", userB: "d", weeksAgo: 1 },
  ]);
  // Neither (a-b) nor (c-d) should appear
  for (const p of result.pairings) {
    const key = [p.userA, p.userB].sort().join("-");
    assert(key !== "a-b" && key !== "c-d", `unwanted rematch: ${key}`);
  }
  assertEquals(result.pairings.length, 2);
});

Deno.test("buildPairings: empty + single-player edge cases", () => {
  assertEquals(buildPairings([], []), { pairings: [], bye: null });
  const r = buildPairings([mk({ userId: "solo" })], []);
  assertEquals(r.bye, "solo");
  assertEquals(r.pairings.length, 0);
});