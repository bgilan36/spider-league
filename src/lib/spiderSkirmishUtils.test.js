import assert from "node:assert/strict";
import test from "node:test";
import {
  pickEvenlyMatchedOpponent,
  resolveIdempotent,
  scoreSkirmishMatch,
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
