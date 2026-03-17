import assert from "node:assert/strict";
import test from "node:test";
import {
  pickEvenlyMatchedOpponent,
  resolveIdempotent,
  scoreSkirmishMatch,
  DEFAULT_SKIRMISH_POWER_BANDS,
} from "./spiderSkirmishUtils.js";

const player = {
  id: "player-spider",
  ownerId: "player",
  powerScore: 100,
  damage: 70,
  webcraft: 60,
  defense: 55,
  speed: 68,
  venom: 62,
};

test("matchmaking prefers an in-band evenly matched opponent", () => {
  const candidates = [
    {
      id: "opponent-far",
      ownerId: "user-2",
      powerScore: 160,
      damage: 80,
      webcraft: 80,
      defense: 80,
      speed: 80,
      venom: 80,
    },
    {
      id: "opponent-close",
      ownerId: "user-3",
      powerScore: 108,
      damage: 71,
      webcraft: 58,
      defense: 56,
      speed: 69,
      venom: 63,
    },
    {
      id: "opponent-mid",
      ownerId: "user-4",
      powerScore: 115,
      damage: 75,
      webcraft: 62,
      defense: 62,
      speed: 72,
      venom: 66,
    },
  ];

  const result = pickEvenlyMatchedOpponent(player, candidates);
  assert.equal(result.opponent?.id, "opponent-close");
  assert.equal(result.usedBand, 0.12);
  assert.ok((result.score ?? 0) > 90);
});

test("matchmaking widens range when no close match exists", () => {
  const candidates = [
    {
      id: "opponent-wide",
      ownerId: "user-2",
      powerScore: 132,
      damage: 72,
      webcraft: 58,
      defense: 58,
      speed: 70,
      venom: 63,
    },
  ];

  const result = pickEvenlyMatchedOpponent(player, candidates);
  assert.equal(result.opponent?.id, "opponent-wide");
  assert.equal(result.usedBand, 0.45);
});

test("matchmaking respects cooldown blocklist", () => {
  const candidates = [
    {
      id: "blocked-opponent",
      ownerId: "user-2",
      powerScore: 104,
      damage: 69,
      webcraft: 61,
      defense: 55,
      speed: 68,
      venom: 61,
    },
    {
      id: "fresh-opponent",
      ownerId: "user-3",
      powerScore: 106,
      damage: 70,
      webcraft: 60,
      defense: 56,
      speed: 68,
      venom: 62,
    },
  ];

  const result = pickEvenlyMatchedOpponent(player, candidates, {
    blockedOpponentIds: new Set(["blocked-opponent"]),
  });

  assert.equal(result.opponent?.id, "fresh-opponent");
});

test("idempotency resolver replays without re-running side effects", () => {
  const cache = new Map();
  let executions = 0;

  const first = resolveIdempotent(cache, "same-key", () => {
    executions += 1;
    return { run: executions };
  });

  const second = resolveIdempotent(cache, "same-key", () => {
    executions += 1;
    return { run: executions };
  });

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(executions, 1);
  assert.deepEqual(second.value, first.value);
});

test("match score penalizes bigger power/stat gaps", () => {
  const nearMatch = {
    id: "near",
    ownerId: "u1",
    powerScore: 103,
    damage: 69,
    webcraft: 60,
    defense: 54,
    speed: 69,
    venom: 61,
  };

  const farMatch = {
    id: "far",
    ownerId: "u2",
    powerScore: 150,
    damage: 85,
    webcraft: 80,
    defense: 82,
    speed: 84,
    venom: 83,
  };

  assert.ok(scoreSkirmishMatch(player, nearMatch) > scoreSkirmishMatch(player, farMatch));
});

// --- New tests for matchmaking fairness ---

test("matchmaking excludes own spiders by ownerId", () => {
  const candidates = [
    { id: "own-spider", ownerId: "player", powerScore: 100, damage: 70, webcraft: 60, defense: 55, speed: 68, venom: 62 },
    { id: "other-spider", ownerId: "user-2", powerScore: 105, damage: 71, webcraft: 59, defense: 56, speed: 69, venom: 63 },
  ];

  const result = pickEvenlyMatchedOpponent(player, candidates);
  assert.equal(result.opponent?.id, "other-spider");
});

test("matchmaking excludes self by id", () => {
  const candidates = [
    { id: "player-spider", ownerId: "other-user", powerScore: 100, damage: 70, webcraft: 60, defense: 55, speed: 68, venom: 62 },
    { id: "valid-opponent", ownerId: "user-2", powerScore: 105, damage: 71, webcraft: 59, defense: 56, speed: 69, venom: 63 },
  ];

  const result = pickEvenlyMatchedOpponent(player, candidates);
  assert.equal(result.opponent?.id, "valid-opponent");
});

test("matchmaking returns null when all candidates blocked", () => {
  const candidates = [
    { id: "only-opponent", ownerId: "user-2", powerScore: 105, damage: 71, webcraft: 59, defense: 56, speed: 69, venom: 63 },
  ];

  const result = pickEvenlyMatchedOpponent(player, candidates, {
    blockedOpponentIds: new Set(["only-opponent"]),
  });

  assert.equal(result.opponent, null);
});

test("matchmaking excludes unapproved spiders", () => {
  const candidates = [
    { id: "unapproved", ownerId: "user-2", powerScore: 102, damage: 70, webcraft: 60, defense: 55, speed: 68, venom: 62, approved: false },
    { id: "approved-far", ownerId: "user-3", powerScore: 150, damage: 80, webcraft: 70, defense: 70, speed: 75, venom: 72 },
  ];

  const result = pickEvenlyMatchedOpponent(player, candidates);
  assert.equal(result.opponent?.id, "approved-far");
});

test("default power bands start narrow and widen", () => {
  assert.ok(DEFAULT_SKIRMISH_POWER_BANDS[0] < DEFAULT_SKIRMISH_POWER_BANDS[DEFAULT_SKIRMISH_POWER_BANDS.length - 1]);
  assert.ok(DEFAULT_SKIRMISH_POWER_BANDS[0] <= 0.15, "First band should be tight (<=15%)");
});

test("idempotency resolver uses different keys independently", () => {
  const cache = new Map();
  let calls = 0;

  resolveIdempotent(cache, "key-a", () => { calls++; return "a"; });
  resolveIdempotent(cache, "key-b", () => { calls++; return "b"; });
  const replayA = resolveIdempotent(cache, "key-a", () => { calls++; return "a2"; });

  assert.equal(calls, 2);
  assert.equal(replayA.replayed, true);
  assert.equal(replayA.value, "a");
});

test("matchmaking falls back to best available when no band matches", () => {
  const candidates = [
    { id: "very-far", ownerId: "user-2", powerScore: 500, damage: 95, webcraft: 90, defense: 90, speed: 90, venom: 90 },
  ];

  const result = pickEvenlyMatchedOpponent(player, candidates);
  assert.equal(result.opponent?.id, "very-far");
  assert.equal(result.usedBand, null, "Should indicate no band matched");
});

test("matchmaking with empty candidates returns null", () => {
  const result = pickEvenlyMatchedOpponent(player, []);
  assert.equal(result.opponent, null);
  assert.equal(result.score, null);
});
