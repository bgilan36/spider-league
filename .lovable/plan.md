## Goal

Make inviting friends from the home page's "Your Pods" section dead-simple — and make it visually impossible to miss when you're the only member of a pod.

## What changes

Inside `FriendPodsHomeSection`, when a pod is selected, fetch its active invite token (same query the pod detail page already runs) and surface invite controls inline.

### Two states

**1. Solo pod (`member_count === 1`)** — the empty-pod problem from the screenshot.

Replace the small "Trophy · 0W–0L this week" + "No pod battles yet" row with a bright, primary-colored call-to-action block:

```text
┌─────────────────────────────────────────────────────────────┐
│  👥  You're flying solo                                     │
│  Pods are way more fun with friends. Invite someone now.    │
│                                                             │
│  [ Share invite ]  [ Copy link ]  [ SMS ]  [ WhatsApp ]    │
└─────────────────────────────────────────────────────────────┘
```

Hides the Pod Standings table and the Battle button entirely while solo (there's no one to battle and nothing to rank). The whole panel becomes about inviting.

**2. Multi-member pod (`member_count >= 2`)** — keep the existing standings/recent-battle row and Battle button exactly as they are, but add a small **"Invite"** button next to the **Battle** button at the bottom right. Clicking it opens a compact dialog containing the existing `PrivateLeagueInvitePanel` (Share / Copy / SMS / WhatsApp). This makes growing an existing pod a one-click action without crowding the panel.

### Reused, not rebuilt

- `PrivateLeagueInvitePanel` already implements Share / Copy / SMS / WhatsApp — reuse it in both states with `hideHeader`.
- Invite token fetch uses the same `private_league_invites` query already in `PrivateLeagueDetail.tsx`.
- `buildShareText` and `/join/<token>` URL format stay identical.

## Files changed

- `src/components/FriendPodsHomeSection.tsx` — fetch invite token for the selected pod; conditionally render the solo-state block or the existing standings + a new "Invite" button that opens a small dialog.

No new components, no migrations, no edge functions.

## Out of scope

- Generating an invite if one doesn't exist (every pod already gets one at creation via `create_private_league_with_invite`).
- Invite analytics / who-joined notifications.
- Email-based invites (current channels — Share/Copy/SMS/WhatsApp — cover the group-chat use case the product is built around).
