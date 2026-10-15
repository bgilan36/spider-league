# Weekly Tournament Roadmap

## Phase 1 — Engine
- [ ] Schema: game_weeks, weekly_entries, brackets, matches, game_seasons standings, trophies, pipeline log, photo hash
- [ ] Shared config + deterministic engine + tests
- [ ] weekly-tournament edge function (lock → build → simulate → publish → open next), idempotent
- [ ] Hourly scheduled job
- [ ] Admin: test week run/reset, display_name, raw bracket inspect

## Phase 2 — Front end
- [ ] Retire manual battles from nav/home/onboarding
- [ ] Home "This Week" (countdown, catch CTA, entries + swap, veteran, pod strip, results card)
- [ ] /week/:weekId results reveal
- [ ] Pod standings, profile trophies + history
- [ ] Public /cup/:weekId + OG image
- [ ] Analytics events + admin view

## Phase 3 — Email (Resend)
- [ ] Resend connection
- [ ] Weekly results email, email_log uniqueness
- [ ] Friday nudge
- [ ] Preferences + one-click unsubscribe
- [ ] Admin test sends
