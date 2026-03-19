

# Spider Leveling & XP Attribution System

## Current State
- **User XP**: Stored in `profiles.xp`. Winners get 25 XP (battles) and 12 XP (skirmishes). A `user_progression` table also exists but isn't used by the frontend.
- **Spider stats**: Spiders gain permanent stat boosts (1-3 random stats, +1-3 each) on victory, but have no XP or level concept.
- **Leaderboard**: Rankings use `total_power_score + xp` as a composite score.

## Proposed Design

### 1. Spider XP & Levels

Add `xp` and `level` columns to the `spiders` table. Spiders earn XP from combat and level up at defined thresholds.

**Level thresholds** (exponential curve):
| Level | Total XP Required |
|-------|-------------------|
| 1     | 0                 |
| 2     | 50                |
| 3     | 120               |
| 4     | 220               |
| 5     | 360               |
| 6     | 550               |
| 7     | 800               |
| 8     | 1100              |
| 9     | 1500              |
| 10    | 2000 (max)        |

**XP earned per combat**:
- Skirmish win: 15 XP to winning spider
- Skirmish loss: 5 XP to losing spider (participation reward)
- Battle win: 30 XP to winning spider
- Battle loss: 10 XP to losing spider (spider transfers to winner with this XP)

This means even losing spiders gain experience, making transferred spiders slightly more valuable over time.

**Level-up bonuses**: On each level-up, the spider gets a small permanent stat boost (+2 to a random stat), displayed with a celebratory notification.

### 2. User Profile XP Attribution

Keep the existing `profiles.xp` system but make it more comprehensive:

**XP sources for users**:
- Battle win: 25 XP (existing)
- Skirmish win: 12 XP (existing)
- Spider levels up: 5 XP per spider level-up (new -- rewards training)
- Upload a new spider (approved): 10 XP (new -- rewards collection building)

No changes to the `profiles` table schema needed; just update the RPCs that award XP.

### 3. Implementation Steps

**Step 1: Database migration**
- Add `xp INTEGER NOT NULL DEFAULT 0` and `level INTEGER NOT NULL DEFAULT 1` to `spiders` table.
- Create a helper function `calculate_spider_level(xp INTEGER) RETURNS INTEGER` that maps XP to level using the threshold table.

**Step 2: Update combat RPCs**
- Modify `start_spider_skirmish` to award spider XP to both winner (15) and loser (5), compute new level, and include level-up info in the response.
- Modify `resolve_battle_challenge` to award spider XP to both winner (30) and loser (10) spiders.
- Award 5 user XP on spider level-up.

**Step 3: Frontend display**
- Show spider level as a badge/number on spider cards (collection, leaderboard, battle screens).
- Add an XP progress bar on `SpiderDetailsModal` showing progress to next level.
- Show a level-up notification/animation when a spider levels up after combat.

**Step 4: Retroactive XP** (optional)
- Run a one-time script to backfill spider XP based on existing battle/skirmish history, so current spiders start at appropriate levels.

### 4. UI Changes Summary

- **Spider cards** (collection, leaderboard, battle): Small "Lv.X" badge near the spider name or power score.
- **SpiderDetailsModal**: XP bar showing current XP / next level threshold.
- **Battle/Skirmish results**: Show "+15 XP" on winning spider, "+5 XP" on losing spider, and "LEVEL UP!" animation if applicable.
- **User profile**: No visual changes needed (XP is already displayed via leaderboard rankings).

