## Rookie Season Onboarding

### 1. Dismissible "Rookie Season" checklist on the dashboard
- New component `src/components/RookieSeasonChecklist.tsx`, mounted in `src/pages/Index.tsx` directly above `<ActiveSpiders />`.
- Card shows 4 steps with a checkmark, XP chip, and a single CTA each:
  1. **Catch your first spider** (+25 XP) → `/upload`
  2. **Win your first battle** (+25 XP) → `/skirmish` (new route, see below)
  3. **Join or create a pod** (+25 XP) → `/pods`
  4. **Challenge a friend** (+25 XP) → `/collection` (the Battle Now buttons live there)
- A "Dismiss" affordance hides the card permanently (`profile_settings.rookie_season_dismissed = true`). Card is also hidden once completed.

### 2. Progress tracking + completion reward
- New `profile_settings` columns: `rookie_season_dismissed` (bool), `rookie_season_completed` (bool).
- New RPC `get_rookie_season_progress()` returns `{caught, won, podded, challenged, completed, dismissed}` derived from existing tables:
  - caught: `spiders` count > 1 for the user (starter already counts as 1)
  - won: any `battle_challenges.winner_id = auth.uid()` OR any `spider_skirmishes` where the user was the winning side
  - podded: any `private_league_members.user_id = auth.uid()`
  - challenged: any `battle_challenges.challenger_id = auth.uid()`
- New RPC `complete_rookie_season()` — idempotent. When all four are true and not yet completed, it awards the new **Rookie Season Champion** badge, adds **+100 XP** to `profiles.xp`, and sets `rookie_season_completed = true`. Returns the awarded state.
- The checklist component calls `complete_rookie_season()` automatically the moment all four steps tick green, then shows a celebration toast.

### 3. New `/skirmish` route ("favorable wild battle")
- Mounts the existing-but-orphaned `<SpiderSkirmishCard />`. This is the closest existing "wild battle" surface; the RPC already picks an opponent within ±12 % power of the player's best spider, which is a fair-to-favorable first matchup for a starter (power 250).
- Added to `src/App.tsx`.

### 4. AI nickname for the starter spider
- The DB trigger `handle_new_user` always creates `"{Display}'s Starter Spider"`. The edge function `create-starter-spider` (called from `OnboardingModal`) currently no-ops when the starter already exists.
- Update `supabase/functions/create-starter-spider/index.ts` to embed the same nickname-generation pools used by `spider-identify` (`NICKNAME_ADJECTIVES`, `NICKNAME_NOUNS`, `MYTHIC_NAMES`, `SINGLE_WORDS`, `generateNickname()`). On every call:
  - If a starter exists with a nickname matching `% Starter Spider`, generate a fresh nickname and `UPDATE` the row (and bump `species` to one of the starter pool species so it isn't generic anymore).
  - If no starter exists, insert with the generated nickname as before.
- Result: every new account that completes the onboarding modal ends up with a personality nickname like *ShadowWeaver* or *Anansi* instead of *Alice's Starter Spider*.

### 5. Badge
- Migration seeds a new badge: **Rookie Season Champion** with criteria `{type: 'rookie_season'}`, rarity `epic`. Awarded only by `complete_rookie_season()`.

### Technical details
- All XP changes go through SQL functions (server-authoritative). The 100 XP bonus uses `UPDATE profiles SET xp = xp + 100 WHERE id = auth.uid()` in `complete_rookie_season()`.
- Per-step XP shown on the card is a visual reward to convey value; actual XP per step is already granted by the underlying flows (upload species claim, battle XP triggers, etc.), so no double-grant.
- Checklist auto-refreshes on focus and after the user returns from a CTA.

### Out of scope
- New "favorable wild battle" matchmaking — we reuse the existing skirmish RPC (already power-banded).
- Replacing the existing 5-slide `OnboardingModal` — it still runs once at signup; the checklist is the post-modal persistent surface.
- Friend-invite/share-link generation for "Challenge a friend" — we route to the existing in-app challenge surface.
