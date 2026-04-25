# Expanded Friend Pods page (`/leagues`)

Turn `/leagues` from a flat list into an at-a-glance hub for the user's "primary" pod, with one-click switching to other pods — so users see standings, recent battles, and members without drilling in.

## UX

- **Pod switcher (top of page)** — horizontal, scrollable strip of all the user's pods rendered as selectable "chips/cards" (image thumbnail + pod name + member count). Single click switches the primary pod shown below. The active pod is visually highlighted (border + background). On mobile this scrolls horizontally; on desktop it wraps if there's room. We'll use a simple flex + `overflow-x-auto` strip (no Embla needed — simpler, snappier, consistent with our hover styles). Includes a "+ New pod" tile at the end.
- **Primary pod panel (below switcher)** — large card showing the selected pod, with three stacked sections:
  1. **Header**: pod thumbnail (`PodThumbnail`), name, member count, "Open pod" button (links to `/leagues/:id` for full detail / settings / chat / battle), and a "Battle a pod member" shortcut for members.
  2. **Standings** (weekly default, with weekly/all-time toggle) — reuse existing `<PrivateLeagueStandings />`.
  3. **Recent battles in this pod** — new section listing the last ~5 battles where `battles.league_id = selectedPodId`, showing both spider thumbnails, who won, and a relative timestamp. Each row links to `/battle/:id`.
  4. **Members** — compact horizontal avatar row with display names (reuses the same data we already fetch for the detail page).
- **Empty state** unchanged: if user has zero pods, show the existing "Compete with your friends" CTA card.

## Data

For each user pod (already fetched in `FriendPodsHomeSection` logic, will be reused/lifted into the page):
- `private_leagues` row (id, name, image_url, owner_id) — already accessible via membership join.
- Member count — already computed.

For the **selected primary pod only** (lazy fetch on selection change):
- `members` — `private_league_members` join with `profiles(display_name, avatar_url)`.
- `standings` — existing RPC `get_private_league_standings({ league_id, timeframe })`.
- `recentBattles` — `battles` table query: `select id, created_at, winner, team_a, team_b where league_id = :id order by created_at desc limit 5`. `team_a`/`team_b` jsonb already contains spider snapshots used elsewhere in the app (see `Index.tsx` recent battle feed pattern).

Persist the user's last-selected primary pod in `localStorage` (`spiderleague:primaryPodId`) so revisits land on the same pod. Falls back to first pod if missing/invalid.

## Files

**Modified — `src/pages/PrivateLeagues.tsx`**
- Replace the simple list rendering with: pod switcher strip + primary pod panel.
- Add state: `selectedPodId`, `primaryData` (members, standings, recentBattles), `timeframe`, loading flags.
- Keep the existing fetch of all user pods (using the `FriendPodsHomeSection` query pattern: memberships → leagues → counts) so the strip and panel share data.
- When `selectedPodId` changes, fetch the three primary-pod datasets in parallel.
- Keep existing auth-gated empty state and "create pod" entry points.

**New — `src/components/PodSwitcherStrip.tsx`**
- Horizontal scrollable strip of pod tiles. Props: `pods`, `selectedId`, `onSelect`, `onCreate`.
- Each tile: `PodThumbnail` + name + member count + active highlight ring.
- Trailing "+ New pod" tile that triggers `CreatePrivateLeagueButton` (rendered as a tile).

**New — `src/components/PrimaryPodPanel.tsx`**
- Receives `pod`, `members`, `standings`, `recentBattles`, `timeframe`, `onTimeframeChange`, `currentUserId`, `loading`.
- Renders header (thumbnail, name, member count, "Open pod" + "Battle a member" buttons), `<PrivateLeagueStandings />`, recent battles list, and members avatar row.
- Recent battles list reuses styling consistent with `Index.tsx` battle feed (spider images, "X defeated Y", relative time, `Link` to `/battle/:id`).

**Modified — `src/components/FriendPodsHomeSection.tsx`** (no functional change required for this task) — leave as-is on the home (`/`) page; this task focuses on `/leagues`.

## Behavior notes

- "Battle a pod member" on the panel deep-links to `/leagues/:id` (the existing detail page already houses the battle picker dialog with eligibility checks). Avoids duplicating that complex picker UI in two places.
- "Open pod" link goes to `/leagues/:id` for chat, invite, and commissioner settings — preserves existing detail page as the deep workspace.
- Recent battles query uses RLS-safe public `battles` SELECT (already viewable by authenticated users per current policy).
- All new components use existing design tokens, `Card`, `Button`, and `PodThumbnail` for visual consistency.

## Out of scope

- No DB migrations needed — `battles.league_id` already exists.
- No changes to `/leagues/:leagueId` detail page.
- No changes to home page (`/`) friend-pods section.
