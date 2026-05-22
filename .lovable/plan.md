## Goal

The `matchups` table exists but nothing writes to it — weekly head-to-head pairings aren't actually being generated today. Build one shared seeding engine that produces weekly pairings for both the **public weekly league** and **private pods**, optimizing for fair, engaging matchups (no blowouts, no repeats, no dead weeks).

## What "fair + engaging" means here

Each candidate pairing gets a score blending four signals; we pick the pairing set that maximizes total score.

1. **Power closeness** — `1 - |powerA - powerB| / max(powerA, powerB)` (caps blowouts)
2. **ELO closeness** — `1 - min(|eloA - eloB|, 400) / 400` (uses `profiles.rating_elo`)
3. **Record similarity** — pair players with similar weekly W-L (Swiss-style); penalty grows with the gap
4. **Rematch avoidance** — hard penalty if the same pair played in the last 2 weeks; soft penalty if ever before

Weights (initial): power 0.35, ELO 0.30, record 0.20, rematch 0.15. Stored as constants in shared code so they're tunable.

Engagement extras:
- **Rivalry boost** — small score bonus when two players are within 1 win of each other on the season (creates narrative)
- **Bye handling** — odd player count: lowest-activity player gets the bye (rotates weekly), not the lowest-power
- **Activity gating** — only seed players who logged in or battled in the last 7 days, so dead accounts don't create dead matchups

## Architecture

```text
                   ┌────────────────────────────┐
                   │  weekly-matchup-seeder     │  (edge fn, cron Monday 00:00 UTC)
                   └──────────────┬─────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
     seedPublicLeague(weekId)              seedPodLeague(weekId, podId)
              │                                       │
              └──────────┬────────────────────────────┘
                         ▼
          _shared/matchup-engine.ts
            • scoreCandidate(a,b,history)
            • buildPairings(players, history)  ← greedy + 1-pass swap optimizer
                         ▼
               insert into matchups (...)
```

## Pairing algorithm (greedy + local search)

1. Pull active players for the surface (public = all active; pod = members).
2. Pull last 4 weeks of `matchups` for rematch history; pull `profiles` for ELO + season record.
3. Compute weekly W-L from current week's resolved battles.
4. Generate all candidate pair scores in one pass (`O(n²)` — fine for pod sizes; capped at top-N candidates per player for public league).
5. **Greedy seed**: sort pairs by score desc, pick non-conflicting pairs until everyone is matched.
6. **Local swap pass**: for each pair (A,B)(C,D), try swapping to (A,C)(B,D) / (A,D)(B,C); keep if total score improves. One pass over all pair combinations.
7. Insert into `matchups` (season_id, week_id, user_a_id, user_b_id, team_a/team_b spider snapshots).

The local swap pass is what turns "decent greedy pairing" into "noticeably fair" — it fixes the typical greedy failure where the last 2 players left over are mismatched.

## New / changed files

- `supabase/functions/_shared/matchup-engine.ts` — pure scoring + pairing (unit-testable, no Supabase imports)
- `supabase/functions/_shared/matchup-engine.test.ts` — Deno tests for: power scoring, rematch penalty, swap pass actually improves total, odd-player bye
- `supabase/functions/weekly-matchup-seeder/index.ts` — entry: resolves current week, calls engine for public + each pod, inserts rows. Idempotent (skip if matchups already exist for week+surface).
- `supabase/functions/weekly-matchup-seeder/index_test.ts` — integration-ish test with mocked supabase client
- Migration: add unique index `(week_id, user_a_id, user_b_id)` on `matchups` to make seeding idempotent; add `pod_league_id uuid` nullable column on `matchups` so the same table serves both surfaces (public = null).
- Cron entry (via insert tool, not migration): schedule `weekly-matchup-seeder` every Monday 00:05 UTC.
- `src/components/MatchupCard.tsx` (new) + a small "This week's matchup" widget surfaced on `Index.tsx` and `PrivateLeagueDetail.tsx` so the new pairings are actually visible.

## Out of scope

- Resolving matchup winners (separate flow that reads battle results).
- Tournament brackets / playoffs.
- Player-initiated re-roll of their matchup.
- ELO recalculation changes — we only *read* `rating_elo`.

## Rollout

1. Migration + shared engine + tests (~half day)
2. Seeder edge function + cron + idempotency (~half day)
3. UI surface for the weekly matchup card (~half day)
4. Backfill current week once manually via direct invoke; verify pairings look sane in DB before cron takes over.
