# SpiderDex Collection Book

A species-level companion to the existing per-spider collection: catalog every species the user has ever uploaded (active + retired), reward first-catches, and reward roster diversity.

## Data

### New tables (migration)

```text
species_collected
  user_id          uuid    (auth.users)
  species_slug     text    canonical key (e.g. "southern_black_widow")
  first_caught_at  timestamptz
  first_spider_id  uuid    -> spiders.id
  count            int     total ever uploaded of this species
  best_power       int     max power_score across history
  best_spider_id   uuid    -> spiders.id (drives the dex card photo)
  PK (user_id, species_slug)
```

Three new rows in `badges`:
- **Naturalist** (rare, 5 species)
- **Field Researcher** (epic, 10 species)
- **Spider Curator** (legendary, 25 species)

### Canonical species reference

`src/lib/spiderDex/species.ts` exports `SPECIES_DEX` — a hand-curated list of ~40 common North American spiders. Each entry:

```ts
{
  slug: "southern_black_widow",
  commonName: "Southern Black Widow",
  scientificName: "Latrodectus mactans",
  family: "Theridiidae",
  rarity: "uncommon",            // dex display rarity
  region: "North America",
  hint: "Often found in woodpiles and dim corners.",
  silhouettePalette: ["#0a0a0a","#7f1d1d"],
  aliases: ["black widow", "Latrodectus mactans"]
}
```

`matchSpeciesSlug(raw: string): string | null` — normalizes a user-typed species (case/punctuation/parenthetical-stripped) and matches against `aliases` + `commonName` + `scientificName`. Falls back to `null` for unknowns (those still get a dex card under a "Wild Catches" section, but don't count toward the common-species progress).

## RPC: `claim_species_for_spider(spider_id uuid)`

Security-definer, public, callable from the upload flow:

1. Resolve owning user; reject if caller isn't owner.
2. Compute `species_slug` from `spiders.species`.
3. Upsert `species_collected` (incrementing `count`, updating `best_power`/`best_spider_id` when this spider beats the current best).
4. If the row was newly inserted **and** the spider is approved:
   - `update profiles set xp = xp + 50`
   - Check badge thresholds (5/10/25 distinct species) and insert `user_badges` rows for any newly crossed.
   - Return `{ new_species: true, xp_awarded: 50, badge_unlocked: text|null, species_slug, common_name }`.
5. Otherwise return `{ new_species: false, count, best_power }`.

## Upload integration

`src/pages/SpiderUpload.tsx` (and any other path that creates a spider — `create-starter-spider` edge function for the starter) calls `claim_species_for_spider(id)` right after the row is created/approved. The starter spider edge function calls the RPC via the service role; the user-facing flow calls it via the supabase client.

When the RPC reports `new_species: true`, the upload success screen plays the **New Species reveal**: a holographic dex-page flip with the species name, silhouette → photo dissolve, "+50 XP" tick-up, and (if applicable) badge unlock toast.

## SpiderDex page

Route: `/dex` — added to `App.tsx` and to `GlobalHeader` (and as a dashboard tile on `/`).

Page sections (all in `src/pages/SpiderDex.tsx`):

```text
1. Header
   "SpiderDex — 12/40 common species"   progress bar
   Sub-stat row: distinct species ever caught, retired memorials, total catches

2. Filter bar
   [All] [Caught] [Uncaught] [Retired only]   + search

3. Grid (responsive 2/3/5 cols)
   • Caught card: real photo (best_spider), common name, scientific (small),
     count chip, "Best ★ <power>", rarity tag. Click → species detail modal.
   • Uncaught card: black silhouette over palette gradient, "???" + hint line.
   • Retired-only badge: subtle "Memorialized" ribbon if every caught spider
     of this species has eligible_until in the past.

4. Wild Catches section (unknown-to-dex species)
   Smaller cards for anything that didn't match a canonical slug.
```

### Species detail modal

Opens from a dex card. Shows every spider the user has ever caught of that species, sorted by power, each with its final stats and battle record (wins/losses from `battles`). Retired spiders sit alongside active ones with a "Retired" badge — never deleted.

## Diversity bonus (leaderboard)

`src/pages/Leaderboard.tsx` already computes weekly user rankings client-side from `spiders` rows within the week's window. Modify the aggregation to also count `distinctSpeciesSlugs.size` per user (via `matchSpeciesSlug`), then apply:

```ts
ranking_score = Math.round(
  (week_power_score + experience_points) * (1 + 0.05 * distinct_species)
);
```

Render a small "× 1.15 diversity" chip next to the score when bonus > 0, so the reward is visible.

## Badge wiring

The three new badges are seeded in the migration. The RPC inserts `user_badges` when thresholds cross; the existing badges page picks them up automatically since it reads from `user_badges`.

## Files

```text
NEW  src/lib/spiderDex/species.ts            canonical list + matcher
NEW  src/lib/spiderDex/useSpeciesProgress.ts hook: collected map + counts
NEW  src/pages/SpiderDex.tsx                 grid + filters + progress header
NEW  src/components/dex/SpeciesCard.tsx      caught/silhouette card
NEW  src/components/dex/SpeciesDetailModal.tsx  history of catches per species
NEW  src/components/dex/NewSpeciesReveal.tsx animated dex-page reveal overlay

EDIT src/App.tsx                             add /dex route
EDIT src/components/GlobalHeader.tsx         add SpiderDex link
EDIT src/pages/SpiderUpload.tsx              call RPC + show reveal on new
EDIT supabase/functions/create-starter-spider/index.ts  call RPC service-side
EDIT src/pages/Leaderboard.tsx               apply diversity multiplier

MIG  species_collected table + grants + RLS + RPC + 3 new badges
```

## Out of scope (callable in follow-ups)

- Push-notifying friends when you complete the dex.
- Region selectors beyond North America.
- A dex-wide share card (the existing per-spider share already covers a "look what I caught" moment).
