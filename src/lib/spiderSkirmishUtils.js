export const DEFAULT_SKIRMISH_POWER_BANDS = [0.12, 0.15, 0.2, 0.3, 0.45];

export function scoreSkirmishMatch(player, opponent) {
  const powerGapRatio = Math.abs(player.powerScore - opponent.powerScore) / Math.max(1, player.powerScore);
  const statGap =
    (Math.abs(player.damage - opponent.damage) +
      Math.abs(player.webcraft - opponent.webcraft) +
      Math.abs(player.defense - opponent.defense) +
      Math.abs(player.speed - opponent.speed) +
      Math.abs(player.venom - opponent.venom)) /
    5;

  return Math.max(1, Math.round((100 - powerGapRatio * 100 - statGap * 0.4) * 100) / 100);
}

export function isWithinPowerBand(playerPowerScore, opponentPowerScore, band) {
  const min = Math.floor(playerPowerScore * (1 - band));
  const max = Math.ceil(playerPowerScore * (1 + band));
  return opponentPowerScore >= min && opponentPowerScore <= max;
}

export function pickEvenlyMatchedOpponent(player, candidates, options = {}) {
  const powerBands = options.powerBands ?? DEFAULT_SKIRMISH_POWER_BANDS;
  const blockedOpponentIds = options.blockedOpponentIds ?? new Set();

  const eligible = candidates.filter(
    (candidate) =>
      candidate.id !== player.id &&
      candidate.ownerId !== player.ownerId &&
      candidate.approved !== false &&
      !blockedOpponentIds.has(candidate.id),
  );

  const rank = (pool) =>
    [...pool].sort((a, b) => {
      const scoreA = scoreSkirmishMatch(player, a);
      const scoreB = scoreSkirmishMatch(player, b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return Math.abs(a.powerScore - player.powerScore) - Math.abs(b.powerScore - player.powerScore);
    });

  for (const band of powerBands) {
    const inBand = eligible.filter((candidate) => isWithinPowerBand(player.powerScore, candidate.powerScore, band));
    if (inBand.length > 0) {
      const opponent = rank(inBand)[0];
      return { opponent, usedBand: band, score: scoreSkirmishMatch(player, opponent) };
    }
  }

  if (eligible.length === 0) {
    return { opponent: null, usedBand: null, score: null };
  }

  const opponent = rank(eligible)[0];
  return { opponent, usedBand: null, score: scoreSkirmishMatch(player, opponent) };
}

export function resolveIdempotent(cache, key, factory) {
  if (cache.has(key)) {
    return { value: cache.get(key), replayed: true };
  }

  const value = factory();
  cache.set(key, value);
  return { value, replayed: false };
}
