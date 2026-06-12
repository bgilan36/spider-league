# Referral Rewards Plan

Build referral rewards on top of the existing pod invite / challenge link flow so inviters and invitees both get rewarded the first time the invitee completes a battle.

## Rewards (per spec)
- **Badges** (one-time, tier-based on lifetime recruit count):
  - Bronze Recruiter — 1 recruit
  - Silver Recruiter — 3 recruits
  - Gold Recruiter — 5 recruits
  - Legendary Recruiter — 10 recruits
  - Invitees get a one-time **"Drafted"** badge when their first battle resolves.
- **Roster slot bonus**: temporary 6th active slot for 30 days, granted to both inviter and invitee on first qualifying battle. Capped at **one** extra slot regardless of how many referrals — additional referrals refresh the existing 30-day expiry rather than stacking.

## Data Model (new migration)

1. **`referrals`** table
   - `inviter_id` (uuid → profiles.id)
   - `invitee_id` (uuid → profiles.id, unique — a user can only be referred once)
   - `source` text (`'pod_invite' | 'challenge_link' | 'manual'`)
   - `source_ref` text nullable (invite token / challenge id)
   - `status` text default `'pending'` (`pending` | `qualified`)
   - `qualified_at` timestamptz nullable
   - `created_at`, `updated_at`

2. **`roster_slot_bonuses`** table
   - `user_id`, `expires_at`, `reason` (`'referral'`), `created_at`
   - Used to compute "extra slot active?" via `expires_at > now()`.

3. **Badges seeding**: insert 5 new rows in `badges` (Bronze/Silver/Gold/Legendary Recruiter + Drafted) with criteria `{ "type": "referrals_qualified", "target": N }` and `{ "type": "drafted" }`.

4. **RPCs**:
   - `record_referral(p_inviter_id, p_source, p_source_ref)` — called client-side on signup if a stored referral code exists. Idempotent; no-op if invitee already has a referral row.
   - `qualify_referral_on_first_battle(p_user_id)` — invoked by a trigger on `battles` / `spider_skirmishes` insert; if invitee's referral is still pending and this is their first completed battle, mark `qualified`, grant 30-day slot bonus to both parties (insert or extend `expires_at`), and award badges (Drafted for invitee, Recruiter tier for inviter based on lifetime qualified count).
   - `get_referral_progress(p_user_id)` — returns `{ qualified_count, pending_count, next_tier, next_tier_target, current_tier, extra_slot_expires_at }`.

5. **Roster cap integration**: `weekly_roster` is currently 1-slot. The "6th slot" maps to the eligible roster size used in `WeeklyEligibleSpiders` / battle eligibility. Add helper SQL function `public.get_user_roster_slot_count(p_user_id)` returning `5 + (case when active bonus then 1 else 0 end)` and update the relevant client checks to read from it (lightweight — most enforcement happens in `WeeklyRosterManager` / `WeeklyEligibleSpiders`).

## Client Changes

- **Referral code capture**: extend `src/pages/Auth.tsx` and the existing invite/challenge link entry points (`JoinLeague.tsx`, challenge accept flow) to stash `?ref=<inviter_id>` (or league/challenge token) in `localStorage` pre-auth, then on `SIGNED_IN` call `record_referral` RPC.
- **Trigger qualification**: hook into existing battle-completion paths (skirmish/turn-based) — simplest is a DB trigger on `battles` set `is_active=false` + winner present, calling `qualify_referral_on_first_battle` for both participants. Same trigger on `spider_skirmishes` insert.
- **Profile progress card**: new component `src/components/ReferralProgressCard.tsx` rendered on the profile page showing:
  - Progress bar "2 of 3 friends recruited toward Gold Recruiter"
  - Current tier badge + next tier preview
  - Active extra-slot countdown ("Bonus 6th slot active — 12d left")
  - Share-your-link button (reuse existing invite link infra, append `?ref=<my_id>`)
- **Roster UI**: surface the bonus slot in `WeeklyRosterManager` / `WeeklyEligibleSpiders` (e.g. extra slot card with "Referral bonus — expires in Xd").

## Technical Details

```text
referrals (unique invitee_id) ──► qualify_referral_on_first_battle()
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
        award Drafted badge   upsert roster_slot_bonuses   award Recruiter tier
        to invitee            (extend expires_at to        based on count(*)
                              now()+30d for both users)    qualified for inviter
```

- Tier evaluation reuses existing `award_badges_for_user` pattern but extends it to handle `type = 'referrals_qualified'` and `type = 'drafted'`.
- Slot stacking cap is enforced by upserting a single row per user and setting `expires_at = greatest(expires_at, now()+30d)` — never adding multiple windows.
- All new tables: standard `GRANT` block (`authenticated` CRUD on own rows, `service_role` ALL), RLS by `auth.uid()`.

## Out of Scope
- Anti-abuse beyond the unique invitee constraint and "first battle must be against a different user" check inside the qualification RPC.
- Email notifications for tier-ups (toast only, for now).
- Redesigning the existing invite/challenge link UI — only adding a `?ref=` param.
