## Goal

Add private “friend pods” so players compete against a small group from their group chat instead of a giant global ladder. The core viral loop will be:

```text
Create Friend League → native share/SMS group-chat link → invitees open link without an account → they preview the league → account/signup only when they choose to join/upload/battle
```

## Product behavior

1. **Private leagues become the primary social competition**
  - Add a “Friend Leagues” / “Private Pods” section on the home dashboard above or near the current leaderboard area.
  - Reframe the main page away from “global rank” as the primary motivator.
  - Keep the existing global leaderboard available, but demote it behind a smaller “Global Leaderboard” link.
2. **One-tap create from group chat**
  - Add a prominent button such as **Create league from group chat**.
  - When tapped by a signed-in user:
    - Create a private league owned by that user.
    - Generate a reusable invite link.
    - Immediately open the device share sheet when available, with SMS/WhatsApp/copy fallbacks.
  - Example share text:
    ```text
    🕷️ Join my Spider League for digital battles with real spiders! 🕷️
    ```

Join my Spider League pod. Let’s see whose spider squad is strongest:
     [https://spiderleague.app/join/{inviteToken}](https://spiderleague.app/join/{inviteToken})
     ```

3. **Invitees do not need an account at invite/open step**
  - `/join/:inviteToken` will be publicly viewable.
  - Unauthenticated invitees can see:
    - League name
    - Creator name
    - Current member count
    - Recent league activity, if any
    - A clear CTA: **Join this league**
  - Only when they tap “Join this league” will they be prompted to sign in/create an account.
  - The invite token will be saved in session storage during auth, then automatically claimed after login.
4. **Private pod standings**
  - Each private league page will show member standings focused on friend-group competition:
    - Wins
    - Losses
    - Win rate
    - Battles against this pod
    - Top active spider
  - Initial standings can be computed from battles tagged with that league.
  - If no league battles exist yet, show a friendly empty state: “Invite friends, then battle inside this pod.”
5. **League-scoped battles**
  - Add a league page where users can:
    - See pod members
    - Challenge a specific member
    - Start a quick training battle against an eligible member spider when possible
  - Battles started from a private league will be tagged with `league_id`, so pod standings stay separate from global activity.
6. **Private league invite UX**
  - Add share controls:
    - Native share sheet
    - SMS
    - WhatsApp
    - Copy invite link
  - Show “Invite friends” prominently if the league has fewer than 2 active members.
  - Group-chat invite link should be reusable, so the creator can paste it into an existing group thread without individually inviting each person.

## Database plan

Create new Supabase tables with RLS:

1. `private_leagues`
  - `id`
  - `owner_id`
  - `name`
  - `slug`
  - `created_at`
  - `updated_at`
  - `is_active`
2. `private_league_members`
  - `id`
  - `league_id`
  - `user_id`
  - `role` (`owner`, `member`)
  - `joined_at`
  - Unique constraint on `(league_id, user_id)`
3. `private_league_invites`
  - `id`
  - `league_id`
  - `token`
  - `created_by`
  - `created_at`
  - `expires_at` nullable
  - `max_uses` nullable
  - `use_count`
  - `is_active`
4. Add nullable `league_id` columns to:
  - `battle_challenges`
  - `battles`

RLS rules:

- League members can view their leagues and member lists.
- League owners can manage invite links.
- Public users can read only safe invite preview information by token through a security-definer RPC, not by directly reading all private league rows.
- Authenticated users can claim a valid invite token through an RPC that inserts membership server-side.

RPCs / functions:

- `create_private_league_with_invite(name text)`  
Creates league, inserts owner as member, creates invite token, returns invite URL data.
- `get_private_league_invite_preview(token text)`  
Public-safe preview for unauthenticated invite landing.
- `claim_private_league_invite(token text)`  
Authenticated user joins the league if token is valid.
- `get_private_league_standings(league_id uuid)`  
Returns pod standings based on league-tagged battles.

## App routes

Add routes in `src/App.tsx`:

```text
/leagues
/leagues/:leagueId
/join/:inviteToken
```

Pages/components to add:

- `src/pages/PrivateLeagues.tsx`
- `src/pages/PrivateLeagueDetail.tsx`
- `src/pages/JoinLeague.tsx`
- `src/components/CreatePrivateLeagueButton.tsx`
- `src/components/PrivateLeagueCard.tsx`
- `src/components/PrivateLeagueStandings.tsx`
- `src/components/PrivateLeagueInvitePanel.tsx`

## Home page changes

In `src/pages/Index.tsx`:

- Add a private leagues module after “Your Starting 5” or before the global leaderboard.
- Replace the main “Leaderboards” emphasis with friend pods:
  - Primary: “Compete with your friends”
  - CTA: “Create league from group chat”
  - Secondary link: “View global leaderboard”
- Keep the global leaderboard preview but visually reduce its priority.

## Auth flow for invitees

Update auth handling so pending league invites survive signup/login:

1. On `/join/:inviteToken`, if unauthenticated and user taps “Join this league”:
  - Store token in `sessionStorage`, e.g. `pendingPrivateLeagueInvite`.
  - Navigate to `/auth`.
2. After authentication:
  - Detect `pendingPrivateLeagueInvite`.
  - Call `claim_private_league_invite`.
  - Clear the pending token.
  - Redirect to `/leagues/:leagueId`.
  - Show toast: “You joined the league.”

This keeps invite opening frictionless while still requiring an account only when the invitee commits.

## Battle integration

Update battle creation paths:

- `quick-battle` edge function accepts optional `leagueId`.
- If `leagueId` is provided:
  - Validate the caller is a member.
  - Select opponents only from other members of that league.
  - Insert `league_id` into `battle_challenges` and `battles`.
- Add “Battle a pod member” actions on the league detail page.
- League standings count only battles with that league’s `league_id`.

## UI tone

Use casual, friend-group language:

- “Your pod”
- “Beat your friends”
- “Invite the group chat”
- “Pod standings”
- “No one’s battled yet. Start the first fight.”

Avoid making the feature feel like another global ladder.

## Implementation order

1. Add database migration for private league tables, indexes, RLS, and RPCs.
2. Add `league_id` to battle-related tables and update battle creation paths.
3. Build invite preview and claim flow.
4. Build league list/detail pages and standings UI.
5. Add home dashboard private pod CTA.
6. Update sharing copy and native share/SMS/WhatsApp fallbacks.
7. Test:
  - Signed-in user creates league and gets share sheet/link.
  - Logged-out invitee can preview invite.
  - Logged-out invitee signs up and automatically joins.
  - League battles are tagged correctly.
  - Pod standings exclude global battles.
  - Non-members cannot view private league details.