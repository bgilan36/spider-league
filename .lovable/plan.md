

# Spider League Combat Simplification Plan

## Overview

Unify Skirmish and Battle into a single "Battle" system, replace weekly eligibility with 30-day rolling windows, add per-spider cooldowns, Quick Battle, and win streaks.

---

## 1. Unified Combat System

**Current state**: Two separate tabs in CombatHub -- "Skirmish" (SpiderSkirmishCard) and "Battles" (ActiveChallengesPreview/BattleMode). Skirmishes use `spider_skirmishes` table and `start_spider_skirmish` RPC. Battles use `battle_challenges`, `battles`, `battle_turns` tables and `auto-battle` edge function.

**Changes**:
- Remove the Skirmish/Battle tab split from `CombatHub.tsx`. Replace with a single unified battle flow.
- The default mode is a **Training Battle** (no ownership transfer, awards XP + stat boosts identical to current skirmish rewards).
- Add an **"All-or-Nothing" toggle** on the challenge creation UI. When enabled, the challenge card shows a visible "All-or-Nothing" badge.
- To accept an All-or-Nothing challenge, the accepter must also confirm the stakes explicitly (a confirmation dialog saying "The loser's spider transfers to the winner").
- **Database migration**: Add `is_all_or_nothing boolean DEFAULT false` column to `battle_challenges` table. Add `stakes_type text DEFAULT 'training'` column to `battles` table.
- **Backend logic**: In `auto-battle/index.ts` and `resolve_battle_challenge` RPC, only execute spider ownership transfer when `stakes_type = 'all_or_nothing'`. Training battles still award XP/stats but skip `transfer_spider_ownership`.
- **Consolidate reward logic**: Training battles award same XP as current skirmishes (12 user XP, 15/5 spider XP, 1-3 stat boosts for winner). All-or-Nothing battles award current battle rewards (25 user XP, 30/10 spider XP, stat boosts + ownership transfer).
- **Remove**: `SpiderSkirmishCard.tsx` component (merge its matchmaking + replay UI into the unified battle flow). Remove the `start_spider_skirmish` RPC usage from the client -- all battles go through the challenge/accept/auto-battle pipeline.
- **New unified flow**: User taps "Quick Battle" or creates a challenge. Matchmaking finds opponent. Battle runs via `auto-battle` edge function. Results shown in a unified replay/outcome screen.

### Files to modify
- `src/components/CombatHub.tsx` -- Remove tabs, single battle UI
- `src/components/SpiderSkirmishCard.tsx` -- Extract replay/results UI into shared component, then deprecate
- `src/components/BattleMode.tsx` -- Add All-or-Nothing toggle to challenge creation
- `src/components/ActiveChallengesPreview.tsx` -- Show stakes badge on challenge cards
- `src/components/ChallengeDetailsModal.tsx` -- Add stakes confirmation for All-or-Nothing
- `src/components/BattleOutcomeReveal.tsx` -- Show "Training" vs "All-or-Nothing" context
- `supabase/functions/auto-battle/index.ts` -- Conditionally skip ownership transfer
- Database migration for new columns

---

## 2. Rolling 30-Day Eligibility

**Current state**: Weekly eligibility via `weekly_uploads` and `weekly_roster` tables, `get_current_pt_week_start()` function, Sunday resets.

**Changes**:
- **Database migration**: Add `eligible_until timestamptz` column to `spiders` table. Set default to `now() + interval '30 days'` on insert. Add a trigger on spider INSERT to auto-set this.
- **Re-enlistment**: Add a "Re-enlist" button on expired spiders that sets `eligible_until = now() + interval '30 days'`. This replaces the weekly roster activation flow.
- **Eligibility check**: Replace all `weekly_uploads`/`weekly_roster` lookups with a simple `WHERE eligible_until > now()` filter on the `spiders` table.
- **Simplify roster**: Remove the 3-slot roster concept. Any spider with `eligible_until > now()` is "Active" and can battle. Keep a cap of 5 active spiders at a time (configurable).
- **Upload flow**: When a spider is uploaded, `eligible_until` is auto-set to 30 days from upload. No weekly_uploads tracking needed for eligibility (keep for upload rate limiting if desired).
- **UI changes**: `WeeklyEligibleSpiders.tsx` renamed/refactored to `ActiveSpiders.tsx`. Show days remaining instead of "This Week's Eligible Spiders". Show "Expired" badge + "Re-enlist" button for spiders past their 30 days.
- **Leaderboard**: Adapt leaderboard queries to use `eligible_until > now()` instead of weekly joins.

### Files to modify
- `src/components/WeeklyEligibleSpiders.tsx` -- Refactor to ActiveSpiders
- `src/components/WeeklyRosterManager.tsx` -- Simplify or remove
- `src/pages/SpiderCollection.tsx` -- Update eligibility logic
- `src/pages/SpiderUpload.tsx` -- Set eligible_until on upload
- `src/pages/Index.tsx` -- Update references
- `src/components/BattleButton.tsx` -- Check eligibility via eligible_until
- Database migration for `eligible_until` column + trigger
- Backfill existing spiders: set `eligible_until` based on `created_at + 30 days` for recently uploaded spiders

---

## 3. Per-Spider Cooldown System

**Current state**: Global 3-skirmishes-per-day limit per user.

**Changes**:
- **Database migration**: Add `last_battled_at timestamptz` column to `spiders` table.
- **Cooldown duration**: 60 minutes after a battle, a spider cannot battle again.
- **Backend enforcement**: Update `auto-battle` edge function and battle creation logic to check `last_battled_at < now() - interval '60 minutes'`. Update `last_battled_at` when a battle completes.
- **Remove daily limit**: Remove the 3-per-day skirmish check from `start_spider_skirmish` RPC (which will be deprecated anyway with unification).
- **UI**: Show cooldown timer on spider cards when `last_battled_at` is within 60 minutes. Disable battle button with "Ready in X min" text.

### Files to modify
- `src/components/BattleButton.tsx` -- Show cooldown state
- `src/components/CombatHub.tsx` -- Show cooldown on selected spider
- `supabase/functions/auto-battle/index.ts` -- Enforce + update cooldown
- Database migration for `last_battled_at` column

---

## 4. Quick Battle Matchmaking

**Changes**:
- Add a prominent "Quick Battle" button to the unified CombatHub.
- On tap: auto-select the user's highest-power eligible spider (or last-used spider), find the closest-matched opponent using existing matchmaking logic, create + auto-accept a Training Battle challenge, and immediately start the auto-battle.
- This is essentially a one-tap version of: create challenge → auto-find opponent → run battle.
- **New edge function or RPC**: `quick_battle` that handles the full flow server-side (pick player spider, find opponent, create battle, run simulation, return results).
- **UI**: Show a loading animation ("Finding opponent...") then transition to battle replay.

### Files to modify
- `src/components/CombatHub.tsx` -- Add Quick Battle button
- New edge function `supabase/functions/quick-battle/index.ts`
- Reuse matchmaking logic from `start_spider_skirmish` RPC

---

## 5. Win Streak System

**Changes**:
- **Database migration**: Add `current_win_streak integer DEFAULT 0` and `longest_win_streak integer DEFAULT 0` columns to `profiles` table.
- **Backend**: After each battle, if the user won, increment `current_win_streak` and update `longest_win_streak` if higher. If lost, reset `current_win_streak` to 0. Add streak XP bonuses: +5 XP per streak level (e.g., 3-streak = +15 bonus XP).
- **UI**: Show a flame/streak icon on the user's profile card and in battle results when on a streak. Show "3 Win Streak! +15 Bonus XP" in the outcome reveal.
- **Badges**: Add streak-based badges (3-streak, 5-streak, 10-streak).

### Files to modify
- `src/pages/Index.tsx` -- Show streak on dashboard
- `src/components/BattleOutcomeReveal.tsx` -- Show streak bonus
- `supabase/functions/auto-battle/index.ts` -- Update streak after battle
- Database migration for streak columns

---

## Implementation Order

1. **Database migrations** (all new columns/tables at once)
2. **Rolling 30-day eligibility** (foundational change, unblocks others)
3. **Unified combat system** (biggest UI change)
4. **Per-spider cooldowns** (small addition on top of unified combat)
5. **Quick Battle** (builds on unified combat)
6. **Win streaks** (independent, can be done in parallel)

---

## Technical Notes

- The `weekly_uploads` and `weekly_roster` tables will still exist but become secondary to the `eligible_until` field. They can be kept for upload rate-limiting (max 3 uploads per week) even as eligibility moves to 30-day rolling.
- The `start_spider_skirmish` RPC can remain for backward compatibility but the client will stop calling it. The unified flow uses `auto-battle` edge function for all combat.
- All existing battle history and skirmish records remain intact -- no data migration needed for historical records.
- The `spider_skirmishes` table stays for historical data; new training battles will use the `battles` table with `stakes_type = 'training'`.

