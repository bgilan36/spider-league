## Goal

Make scoring rewards reflect the **power gap** between spiders, and rank pod standings by **Win Point Differential (WPD)** instead of pure W-L.

Two rules:
1. **XP gain scales with the opponent's relative power.** If you beat a much weaker opponent, you earn little/no XP. Beating a stronger opponent earns more.
2. **Win Point Differential** is the primary standings metric. You only *gain* WPD when beating a stronger opponent (the power gap is your reward). Beating a weaker opponent gives **0 WPD** (no penalty, no reward). Losing to a stronger opponent costs **0 WPD**. Losing to a weaker opponent costs WPD equal to the gap.

---

## Scoring formulas

Let `winner_power` and `loser_power` be the spider power scores at battle time, and `gap = loser_power - winner_power` (positive when winner beat a stronger opponent).

### Win Point Differential (per battle, per user)
- Winner: `wpd = max(0, gap)` — only rewarded for upsets.
- Loser:  `wpd = min(0, gap)` — only penalized when they were the favorite (gap > 0 for the winner means the loser was stronger... so loser's wpd uses `loser_power - winner_power` from their own perspective: penalty when they were stronger).
  - Concretely: if loser was stronger (loser_power > winner_power), loser loses `loser_power - winner_power` WPD. If loser was weaker, loser loses 0.
- Net effect: WPD is symmetric — winner gains exactly what loser loses, but both are 0 when the favorite wins.

### XP gain (battle winner)
Compute a **power ratio** `r = winner_power / max(1, loser_power)`:
- `r >= 1.5` (winner ≥1.5× stronger): **0 XP** (trivial win).
- `1.2 <= r < 1.5`: **25%** of base XP.
- `0.9 <= r < 1.2` (even match): **100%** of base XP.
- `r < 0.9` (upset, winner weaker): **150%** of base XP.

Base XP stays at the existing `v_battle_xp` (12 training / 25 all-or-nothing). Spider XP awards (`v_winner_spider_xp`, `v_loser_spider_xp`) are scaled by the same multiplier to keep stat progression aligned. Streak bonus XP unchanged.

---

## Implementation

### 1. New migration — update `resolve_battle_challenge`

In `supabase/migrations/<new-timestamp>_power_aware_scoring.sql`:

- Read `power_score` for `winner_spider` and `loser_spider` from `public.spiders`.
- Compute `r` and a `v_xp_multiplier numeric`.
- Apply multiplier to `v_battle_xp`, `v_winner_spider_xp`, `v_loser_spider_xp` (round to int, floor at 0).
- Return additional fields in the JSONB result: `winner_power`, `loser_power`, `power_ratio`, `xp_multiplier`, `wpd_awarded`.

No schema change needed — power scores live on the existing `spiders` row.

### 2. New migration — update `get_private_league_standings`

In the same migration file, replace the function so:
- `power_diff` (renamed conceptually to **win_point_diff** but kept as `power_diff` column for type-stability with the frontend) is computed as:
  ```sql
  SUM(CASE
    WHEN br.winner_user = m.user_id THEN GREATEST(0, br.loser_power - br.winner_power)
    WHEN br.loser_user  = m.user_id THEN LEAST(0, br.winner_power - br.loser_power)
    ELSE 0
  END)
  ```
  (Winner gets `max(0, gap)`, loser gets `min(0, -gap)` = penalty only when they were the stronger side.)
- `ORDER BY pu.power_diff DESC, pu.wins DESC, pu.win_rate DESC, pu.battles DESC` — **WPD becomes the primary sort key**.

Battle row CTE already extracts `a_power` and `b_power` from `team_a/team_b->>'{spider,power_score}'`; we add named `winner_power` / `loser_power` for clarity.

### 3. Frontend — `src/components/PrivateLeagueStandings.tsx`

- Rename the **DIFF** column to **WPD** (header text + tooltip).
- Update tooltip: "Win Point Differential — points earned by beating higher-power opponents minus points lost when stronger opponents lose to weaker ones. Primary standings sort."
- Move the WPD column to be the **first stat column** (left of W/L) so it visually anchors as primary.
- Keep formatting/coloring (`+`/`-`, primary/destructive).

### 4. Frontend — `src/hooks/usePodStandings.ts`

No type changes (still returns `power_diff`); add a JSDoc note that this represents WPD per the new formula.

### 5. Optional: surface XP-multiplier in battle result

`InteractiveBattleArena` / `BattleOutcomeReveal` already display battle XP. If `xp_multiplier !== 1`, append a small label like "Even match +25%" / "Upset +50%" / "Mismatch — no XP" near the XP awarded line, sourced from the new `xp_multiplier` field returned by `resolve_battle_challenge`. (Plumbing-only; non-blocking if any consumer doesn't read it.)

---

## Files

- **New**: `supabase/migrations/<ts>_power_aware_scoring.sql` (recreates `resolve_battle_challenge` and `get_private_league_standings`).
- **Edited**: `src/components/PrivateLeagueStandings.tsx` (column rename, reorder, tooltip).
- **Edited (optional, small)**: `src/components/BattleOutcomeReveal.tsx` to show multiplier label when present.

## Out of scope

- Historical recalculation of past battles' XP (cannot retroactively un-award profile XP). Standings recompute automatically since they read from `battles` rows.
- Changes to the public Leaderboard page sorting (only pod standings are explicitly requested).