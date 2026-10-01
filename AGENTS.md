- Keep downloadable spider and battle share art in the shared canvas drawing module and make the public 1200×630 preview separately; this keeps social cards consistent without relying on crawler-side canvas rendering.
- Version cached share-card filenames when changing card designs; this prevents stale uploaded images from appearing in shared links.
- Route every selected spider photo, including home-page handoffs, through the client-side crop step before identification and storage; this keeps the AI input and saved fighter photo identical.
- Training battle opponents are picked and validated only by the server (`_shared/matchmaking.ts`); previews call battle-start `action:"preview"` and confirms send `bindOpponent` + `idempotencyKey`, so the arena always matches the preview and double taps return the same battle.
- Demo accounts are flagged by `profiles.is_demo` (set at signup, not user-editable) and excluded from rankings, public feeds, matchmaking pools, stakes, and real players' rewards; keep new public/competitive queries filtering on it.
- Starter spiders are provisioned through `src/lib/starterSpider.ts` (deduped, retried) when onboarding opens and whenever a roster has zero spiders — never tied to a specific onboarding slide.

- Gameplay numbers and mode names (Training, Friendly Challenge, Capture Battle, Wild Skirmish) live in `src/lib/gameRules.ts`, mirroring server enforcement; UI copy must read from it so help, onboarding and previews never contradict the server.
- First battles use battle-start `practice:true` (AI-controlled opponent, challenge_message "Practice Battle"); Rookie Season milestone XP is paid only via `claim_rookie_milestone`, so rewards are server-checked and paid once.
- Player "what's next" state (active battles, incoming challenges, spider Ready/Cooldown/Retired/In battle) comes from `src/hooks/usePlayerActions.ts`; Home Next up, the Battles hub and spider cards share it so they never disagree.
