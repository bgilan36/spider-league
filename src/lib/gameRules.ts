/**
 * Canonical Spider League rules.
 *
 * Every number here mirrors what the server actually enforces. If you change
 * a server rule, change it here in the same edit — all onboarding, help,
 * roster, cooldown, upload, preview and leaderboard copy reads from this file.
 *
 * Sources of truth:
 * - Roster size:      get_user_roster_slot_count() (5, +1 with an active referral bonus)
 * - Eligibility:      set_spider_eligible_until trigger (30 days) + battle-start matchmaking
 * - Battle cooldown:  supabase/functions/_shared/matchmaking.ts COOLDOWN_MS (4h)
 * - Skirmish limit:   start_spider_skirmish() (3 per Pacific-time day)
 * - Battle rewards:   resolve_battle_challenge() + award_spider_xp()
 * - Rankings:         get_user_rankings_all_time / weekly (Power + spider XP)
 * - Challenges:       supabase/functions/challenge (48h to respond, 12h per move)
 */

export const RULES = {
  roster: {
    baseSlots: 5,
    bonusSlots: 1, // while a referral roster bonus is active
    eligibleDays: 30,
  },
  battleCooldownHours: 4,
  skirmish: {
    dailyLimit: 3,
    playerXpOnWin: 12,
    spiderXpWin: 15,
    spiderXpLoss: 5,
  },
  battle: {
    spiderXpWin: 25,
    spiderXpLoss: 10,
    captureSpiderXpWin: 50,
  },
  levelPowerBonus: 5,
  challengeExpiryMaxDays: 7,
  challenge: {
    responseHours: 48, // a challenge expires if nobody accepts in time
    moveHours: 12,     // per move in a Friendly Challenge / Capture Battle
  },
} as const;

export const CHALLENGE_TIMING = {
  response: `The other player has ${RULES.challenge.responseHours} hours to accept or decline. After that it expires — nothing happens to either spider.`,
  moves: `Battles are turn by turn, not live. Each player gets ${RULES.challenge.moveHours} hours per move and gets notified when it's their turn.`,
  timeout: `Miss a move deadline and the computer plays the rest of your battle for you, so it always finishes. Results count normally.`,
};

export const BATTLE_COOLDOWN_MS = RULES.battleCooldownHours * 60 * 60 * 1000;
export const ELIGIBLE_MS = RULES.roster.eligibleDays * 24 * 60 * 60 * 1000;

/** Official mode names. Use these everywhere — never "Battle to the Death", "All-or-Nothing", or "Death Battle". */
export const MODES = {
  training: {
    name: "Training",
    long: "Training Battle",
    who: "Server-matched opponent of similar Power, or a spider you pick. No acceptance needed.",
    rewards: `Winning spider: +${RULES.battle.spiderXpWin} XP and 1–3 small stat boosts. Losing spider: +${RULES.battle.spiderXpLoss} XP.`,
    eligibility: "Uses a Starting 5 spider that is not on cooldown.",
    cooldown: `Your spider rests ${RULES.battleCooldownHours} hours afterward.`,
    risk: "No ownership risk — nobody loses a spider.",
  },
  friendly: {
    name: "Friendly Challenge",
    long: "Friendly Challenge",
    who: "Challenge a specific player (or post an open challenge). They accept with one of their Starting 5, then you take turns.",
    rewards: `Same as Training: winner +${RULES.battle.spiderXpWin} XP and stat boosts, loser +${RULES.battle.spiderXpLoss} XP.`,
    eligibility: "Both spiders must be in their owner's Starting 5.",
    cooldown: `The challenging spider rests ${RULES.battleCooldownHours} hours afterward.`,
    risk: "No ownership risk — both players keep their spiders.",
  },
  capture: {
    name: "Capture Battle",
    long: "Capture Battle",
    who: "Opt-in only. Both players must confirm the exact two spiders at stake before it starts.",
    rewards: `Winning spider: +${RULES.battle.captureSpiderXpWin} XP and stat boosts, plus the winner takes the losing spider. Losing spider: +${RULES.battle.spiderXpLoss} XP.`,
    eligibility: "Both spiders must be in their owner's Starting 5. Demo accounts can't play.",
    cooldown: `The challenging spider rests ${RULES.battleCooldownHours} hours afterward.`,
    risk: "Ownership risk: the losing spider permanently moves to the winner.",
  },
  skirmish: {
    name: "Wild Skirmish",
    long: "Wild Skirmish",
    who: "Instant auto-battle against a similar-Power spider.",
    rewards: `Win: +${RULES.skirmish.playerXpOnWin} trainer XP, +${RULES.skirmish.spiderXpWin} spider XP and small stat boosts. Loss: +${RULES.skirmish.spiderXpLoss} spider XP.`,
    eligibility: "Any spider in your collection, including retired ones.",
    cooldown: `${RULES.skirmish.dailyLimit} per day (resets midnight Pacific). No per-spider cooldown.`,
    risk: "No ownership risk.",
  },
} as const;

export type ModeKey = keyof typeof MODES;

export const ROSTER_COPY = {
  summary: (slots: number = RULES.roster.baseSlots) =>
    `Up to ${slots} spiders can be active in your Starting 5. Only active spiders can enter Training, Friendly Challenges or Capture Battles.`,
  eligibility: `A spider stays active for ${RULES.roster.eligibleDays} days after it's caught or re-enlisted, then retires to your collection.`,
  retirement:
    "Retiring never changes ownership or progress: retired spiders keep their XP, level, stats and Power, still count toward rankings, and can still Skirmish. Re-enlist one any time a slot is open.",
  bonusSlot: `Referral rewards can add ${RULES.roster.bonusSlots} temporary extra slot.`,
  uploads:
    "There's no upload limit. If your Starting 5 is full, you'll choose which spider to retire.",
};

export const RANKING_COPY = {
  formula: "Trainer score = total spider Power + total spider XP.",
  allTime: "All-time: Power + XP across every spider you own.",
  weekly: "Weekly: Power + XP from spiders caught this week.",
  spiders: "Spider rankings are by Power alone.",
};

export function hoursUntilReady(lastBattledAt?: string | null): number {
  if (!lastBattledAt) return 0;
  const ms = new Date(lastBattledAt).getTime() + BATTLE_COOLDOWN_MS - Date.now();
  return ms > 0 ? ms / 3_600_000 : 0;
}

/** "2h 15m" style label for the remaining cooldown. */
export function cooldownLabel(lastBattledAt?: string | null): string | null {
  const h = hoursUntilReady(lastBattledAt);
  if (h <= 0) return null;
  const mins = Math.ceil(h * 60);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
}

export function readyAtLabel(lastBattledAt?: string | null): string | null {
  if (!lastBattledAt || hoursUntilReady(lastBattledAt) <= 0) return null;
  return new Date(new Date(lastBattledAt).getTime() + BATTLE_COOLDOWN_MS)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
