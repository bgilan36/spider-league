## Goal

Make Spider League's core battle loop more compelling so players come back daily. Focus: gameplay depth + daily-reason-to-return mechanics. Built around the existing turn-based stance system (power/quick/venom × iron-web/evasive/counter-sting) and pod standings.

## Strategy

Daily retention in a battler comes from three reinforcing hooks:
1. **A daily reason to log in** (limited-time content that resets every 24h).
2. **Visible short-term progress** (something improves every session).
3. **Tactical depth that rewards mastery** (skill ceiling so battles stay fresh).

This plan adds one feature per hook plus a battle-depth upgrade.

---

## 1. Daily Bounties (the "log in today" hook)

Each day, every player gets 3 rotating bounties shown on the home screen:
- "Win 2 battles using Venom Bite"
- "Land 3 Perfect-zone attacks"
- "Beat a spider with higher power than yours"
- "Survive a battle to turn 8+"
- "Win using Counter-Sting defense"

Rewards: XP, a stat-boost token, or a cosmetic shard. Streak bonus for completing all 3 days in a row (escalating reward). Bounties reset at 00:00 UTC.

**Why it works:** gives a concrete, finite task list that resets daily — the single strongest DAU lever for battle games.

---

## 2. Spider Mood / Energy system (the "visible progress" hook)

Each spider has a daily energy meter (e.g. 5 battles/day at full power). Battling while rested gives bonus XP; over-battling drops the spider into "tired" state with reduced stats. Energy regenerates over time, with a small boost on first login each day.

Adds: a daily "check on my spiders" reason, soft cap that prevents one-day grinding, and a clear visual that *something changed* between sessions.

---

## 3. Battle depth: Stance Combos + Reactive Reads

Currently each turn is one stance pick. Two upgrades:

- **Stance Combos**: chaining the same attack stance twice in a row triggers a penalty (predictable), but alternating in a 3-turn pattern (e.g. Power → Quick → Venom) unlocks a "Combo Strike" bonus on the third hit. Adds a planning layer beyond per-turn choice.
- **Reactive Reads**: at battle start, show the opponent's *preferred* stance (derived from their last 5 battles). Pick a counter-stance for the first turn to get a "Read" bonus. Adds a meta-game of scouting opponents.

Both are additive on top of existing math — no rebalance of base damage needed.

---

## 4. Pod-vs-Pod weekly clash (the "social pull" hook)

Existing pods already have standings. Add a weekly auto-scheduled "Pod Clash": every Sunday, your pod is matched against another pod of similar avg power. Members earn pod-points by battling that week; the pod with the most points wins a banner badge displayed on profiles.

Pulls solo players into checking in for their teammates — strongest social retention mechanic available given the existing pod infrastructure.

---

## Technical sketch

- **Bounties**: new `daily_bounties` table (user_id, date, bounty_key, progress, target, completed_at). Edge function `bounty-tick` called from battle resolution updates progress. Frontend widget on Index.tsx home.
- **Energy**: add `energy`, `energy_updated_at` columns to `spiders`. Compute current energy on read. Battle-start validates ≥1 energy; battle-resolve decrements. XP multiplier adjusted in `resolve_battle_challenge`.
- **Combos**: track last 3 attack stances in `battles.turns` JSON (already stored). `_shared/battle-math.ts` reads last 2 turns and applies combo modifier.
- **Reads**: new view/RPC `spider_recent_stance_preference(spider_id)` returning top stance from last 5 battles. Surface in StancePicker on turn 1 only.
- **Pod Clash**: new `pod_clashes` table (week, pod_a, pod_b, score_a, score_b, winner). Cron edge function `pod-clash-scheduler` weekly. Counted automatically as battles resolve.

## Rollout order

1. Daily Bounties (highest DAU impact, ~2 days work)
2. Spider Energy (1 day, gates grinding before combos go live)
3. Stance Combos + Reads (2 days, depth)
4. Pod Clashes (2 days, social layer last so it sits on top of everything else)

## Out of scope

- Monetization, cosmetics shop expansion, new spider types, PvP matchmaking rework.
