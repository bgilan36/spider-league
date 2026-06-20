## Goal

Send an email to a spider's owner when another player initiates a battle against that spider while the owner is offline, so the owner sees it on next login and can quickly tap the existing "Rematch" flow in `MissedBattleModal`.

## Steps

### 1. Set up Lovable Emails on `spiderleague.app`
- Provision a sender subdomain `notify.spiderleague.app` via the email setup dialog (NS delegation to Lovable). DNS propagation happens in the background — no blocker for code work.
- Run shared email infrastructure setup (creates the queue, send log, suppression list, unsubscribe tokens, cron worker).

### 2. Scaffold transactional email function + template
- Scaffold `send-transactional-email` and the unsubscribe handler.
- Add a new template `battle-challenge-received.tsx` in `supabase/functions/_shared/transactional-email-templates/` — brand-styled, mentions the opponent's spider nickname, the user's spider that's being challenged, win/loss/training stakes, and a CTA button "View battle" linking to `https://spiderleague.app/battle/<id>`.
- Register it in `registry.ts`.

### 3. Trigger the email from `battle-start`
- In `supabase/functions/battle-start/index.ts`, after the battle row is created, fire-and-forget invoke `send-transactional-email` for the opponent (`opponent.owner_id`):
  - Look up opponent's email via the existing `get_user_emails_for_profiles` RPC.
  - Check `profile_settings.email_communications_enabled` for the opponent — skip if false.
  - Use `idempotencyKey: battle-challenge-<battleId>` so retries don't duplicate.
  - Pass `templateData`: opponent spider nickname, challenger display name + their spider nickname, battle URL.
- Do the same in `quick-battle` and `auto-battle` only if we want symmetry — **out of scope for now** per the user's "only when opponent initiates" choice. `battle-start` is the user-initiated PvP path; `auto-battle` is system-driven, `quick-battle` is the same intent as `battle-start` so we'll wire both `battle-start` and `quick-battle`.

### 4. No new opt-out UI
- Reuse the existing `profile_settings.email_communications_enabled` toggle. The standard one-click unsubscribe footer is appended automatically.

### 5. Verify
- Deploy edge functions.
- Trigger a test battle from one account; confirm a row appears in `email_send_log` with status `sent` for the opponent and that the opponent's `MissedBattleModal` already surfaces the rematch on next login (already built).

## Technical Notes

- Emails activate only after DNS verification of `notify.spiderleague.app`. Until then sends will queue/log but not deliver — monitorable in Cloud → Emails.
- Email send is wrapped in try/catch so an email failure never blocks battle creation.
- Recipient lookup is server-side only (service role), never exposed to the client.

## Out of Scope

- Email on battle results / turn notifications (can be added later).
- Per-event opt-out granularity (single toggle for now).
- Push notifications.
