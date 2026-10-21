/**
 * Every tunable value for the weekly tournament loop.
 * Imported by the edge functions AND the web app (via @tournament-config),
 * so copy and server behaviour never disagree.
 */
export const TOURNAMENT = {
  TIMEZONE: "America/Los_Angeles",
  /** Week opens Monday 00:00 local time. */
  WEEK_START_DOW: 1,
  /** Entries lock Sunday at this local hour. */
  LOCK_DOW: 0,
  LOCK_HOUR: 17,
  LOCK_LABEL: "Sunday at 5pm PT",

  MAX_ENTRIES_PER_USER: 3,
  VETERAN_MULTIPLIER: 0.85,

  MIN_POD_BRACKET: 8,
  MIN_GLOBAL_BRACKET: 16,
  /** Pods smaller than this many real entries are skipped entirely. */
  MIN_REAL_POD_ENTRIES: 2,

  WILD_STAT_PERCENTILE_LOW: 0.25,
  WILD_STAT_PERCENTILE_HIGH: 0.6,
  /** Use all-time uploads for Wild stats when a week has fewer real entries than this. */
  WILD_MIN_REAL_SAMPLE: 5,

  ROUNDS_PER_MATCH: 3,
  ROUNDS_TO_WIN: 2,
  /** Round strength = blend of attribute and Power Score. */
  ATTRIBUTE_WEIGHT: 0.5,
  POWER_WEIGHT: 0.5,
  /** Round win probability exponent: a^k / (a^k + b^k). */
  WIN_EXPONENT: 3,

  /** Large brackets show my path plus this round size onward. */
  FOCUS_FROM_ROUND_OF: 16,
  /** Results reveal playback speed per round (ms). Cinematic: each round gets a title card first. */
  REVEAL_MS_PER_ROUND: 2600,

  POINTS_PER_MATCH_WIN: 1,
  POINTS_POD_CHAMPION: 3,

  /** Friday reminder: local day/hour, and lookback for "recently active". */
  NUDGE_DOW: 5,
  NUDGE_HOUR: 9,
  NUDGE_ACTIVE_WEEKS: 4,

  /** Lovable AI model used for final recaps. */
  RECAP_MODEL: "google/gemini-3.8-flash",

  EMAIL_FROM: "Spider League <hello@spiderleague.app>",
  EMAIL_REPLY_TO: "bgilan@gmail.com",
  SITE_URL: "https://spiderleague.app",
  /** Starter spiders are gifts, not catches — never count as fresh. */
  STARTER_SPECIES: "Spider League Starter Spider",
} as const;

export const STAT_KEYS = ["hit_points", "damage", "speed", "defense", "venom", "webcraft"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  hit_points: "toughness",
  damage: "bite",
  speed: "speed",
  defense: "armor",
  venom: "venom",
  webcraft: "webcraft",
};

/** ~30 common real species used to name Wild Challengers. */
export const WILD_SPECIES = [
  "Orb Weaver", "Jumping Spider", "Wolf Spider", "Cellar Spider", "Crab Spider",
  "Garden Spider", "Funnel Weaver", "Cobweb Spider", "Sheetweb Weaver", "Lynx Spider",
  "Nursery Web Spider", "Fishing Spider", "Ground Spider", "Sac Spider", "Grass Spider",
  "Marbled Orb Weaver", "Spotted Orb Weaver", "Barn Funnel Weaver", "Zebra Jumper", "Bold Jumper",
  "Daring Jumper", "Woodlouse Hunter", "Hobo Spider", "House Spider", "Trashline Orb Weaver",
  "Arrowhead Spider", "Spined Micrathena", "Long-jawed Orb Weaver", "Running Crab Spider", "Lattice Orb Weaver",
] as const;

export const ROUND_NAMES: Record<number, string> = {
  2: "Final",
  4: "Final Four",
  8: "Elite 8",
  16: "Sweet 16",
  32: "Round of 32",
  64: "Round of 64",
};

/** "Final", "Elite 8"... for a round with `remaining` spiders in it. */
export function roundName(remaining: number): string {
  return ROUND_NAMES[remaining] ?? `Round of ${remaining}`;
}
