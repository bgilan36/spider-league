# Interactive Battles: Manual Dice Rolls + Skill Mechanics

Today, every battle is fully simulated on the server (`quick-battle` / `auto-battle`) and the client just animates a finished log. We will make battles interactive: the player taps to roll their own dice on offense and defense, and skill (timing + a pre-battle ability pick) measurably tilts outcomes — so a smart player can beat a higher-power spider more often than today.

## Goals

- Player manually triggers each dice roll and immediately sees how the number affects damage / defense.
- Add real skill levers (timing and ability selection) so wins aren't pure RNG.
- Higher-power opponents still favored, but a skilled underdog wins meaningfully more than the current ~chance baseline.
- Keep server authoritative (no client-trusted damage) to prevent cheating.

## Player Experience

Pre-battle (10s screen):
- Choose 1 of 3 Attack Stances and 1 of 3 Defense Stances per battle. Each is a tradeoff (e.g., Power Strike: +crit window, smaller hit window). Choices are part of the matchup preview.

Each turn (alternating, you start if your spider is faster):
1. Your offense — tap "Roll Attack". A 0–20 meter sweeps left↔right; tap "Lock" inside a highlighted Skill Zone to bias the roll high. Damage is shown immediately, with a breakdown (base + dice mod + stance + crit).
2. Opponent offense — tap "Roll Defense". Same meter; a good lock raises your defense for that incoming hit and can trigger a dodge. The hit lands with a clear damage popup.
3. Repeat until one spider hits 0 HP or max turns reached.

Opponents (PvE quick battle): the server plays the opponent with average-skill timing so matches feel like a real opponent.

## Skill Mechanics (how skill beats luck)

Per-roll timing meter:
- Skill Zone covers ~25% of the bar; perfect center sub-zone is ~6%.
- Hit Skill Zone: dice min raised from 1 to 8 (offense) / 6 (defense).
- Hit Perfect: roll forced to 18–20 range, and crit window widens by +1.
- Miss zone: dice rerolled with a -2 penalty applied.

Stance picks (tradeoffs, not strictly better):
- Attack: Power Strike (+30% crit damage, narrower Skill Zone), Quick Strike (+1 extra attack roll on a Perfect, no crit bonus), Venom Bite (uses venom stat instead of damage, ignores 30% defense).
- Defense: Iron Web (+25% defense vs normal hits, can't dodge), Evasive (dodge chance scales with defender dice ≥17), Counter-Sting (taking damage stores +20% damage on next attack roll).

Underdog catch-up:
- If opponent power_score is higher, defender's Skill Zone is widened slightly (caps at +50% width vs power gap), so a focused player gets more "windows" to swing the fight. This is the main lever that lets skill overcome stat gaps.

Approximate impact: in internal math, a player consistently hitting the Skill Zone (~70%+) beats an opponent ~25% stronger ~55–60% of the time, vs ~30% in pure RNG today.

## Anti-Cheat / Server Authority

- All randomness uses a server-seeded PRNG (`battles.rng_seed`). The server precomputes the dice roll *for that turn index* before the player taps; the player's input only chooses the timing-zone bucket (`miss | zone | perfect`), and the server applies the matching modifier.
- Each turn submission goes through a new edge function `battle-turn` which:
  - Validates auth, that the user owns the current turn, and turn index = current.
  - Recomputes the dice + damage from seed + stance + zoneBucket.
  - Writes the canonical `battle_turns` row and updates `battles` HP / current_turn_user_id.
- Client-displayed damage matches the server response; if there's a mismatch the client snaps to server state.

## Technical Plan

Database (migration):
- `battles`: add `mode TEXT NOT NULL DEFAULT 'interactive'` ('interactive' | 'auto'), `attacker_stance TEXT`, `defender_stance TEXT` (current player stances by user id stored in a JSON column `stances jsonb` keyed by user id), `awaiting_action TEXT` ('attack' | 'defense' | null), `awaiting_user_id UUID`.
- Use existing `battle_turns.action_payload` to store `{ zoneBucket, stance }` per turn, and `result_payload` for damage breakdown so the UI can show the math.

Edge functions:
- New `battle-start` (or extend `quick-battle`): pre-battle stance pick screen calls this with `{ playerStance: { attack, defense }, opponentSpiderId? }`. It creates the battle in `interactive` mode with `is_active=true`, `awaiting_action='attack'`, and returns `battleId`. No turns are precomputed.
- New `battle-turn`: body `{ battleId, zoneBucket: 'miss'|'zone'|'perfect' }`. Validates ownership of `awaiting_user_id`, derives dice from `rng_seed + turn_index`, applies stance + zoneBucket, writes the turn row, flips `awaiting_user_id`/`awaiting_action`, and on KO calls existing `resolve_battle_challenge` + badges.
- New `battle-opponent-turn`: invoked by client after a defense step or when it's the AI's offensive turn (PvE). Server picks an AI `zoneBucket` (weighted by a configurable difficulty curve based on opponent power), then runs the same logic as `battle-turn`. For PvP we instead wait on realtime for the other player's call.
- Keep `auto-battle` as fallback when `mode='auto'` (timeouts, missed presence).

Client:
- `src/pages/TurnBasedBattle.tsx`: split into `PreBattleStancePicker` + `InteractiveBattleArena`. Replace auto-playback with an interactive flow driven by realtime subscription to `battles` + `battle_turns`. Show damage breakdown and stance icons each turn.
- New `SkillMeter` component (reusable for offense + defense): animated bar with Skill Zone + Perfect sub-zone, "Roll" then "Lock" buttons, accessibility (keyboard/space to lock), reduced-motion fallback.
- Update entry points that call `quick-battle` (`ActiveSpiders.handleConfirmBattle`, `CombatHub`, `FriendPodsHomeSection`, `PrivateLeagueDetail`) to first show the stance picker, then call `battle-start`.
- Add a "Skip / Auto-resolve" link on the stance picker for users who prefer the old flow → routes through `auto-battle`.

Tuning + safety:
- Cap turns at 12 to keep duration reasonable; per-action timeout 15s — server auto-picks `miss` if exceeded so battles can't stall.
- Difficulty curve for AI zoneBucket lives in one helper so it's easy to retune.
- Add unit tests for the damage formula and the underdog widening.

## Out of Scope (for this change)

- True realtime PvP matchmaking UI (we'll support PvP if both players are present, but no new matchmaking lobby).
- Cosmetic spider abilities tied to species (kept generic per stance for now).

After approval I'll implement the migration, the two new edge functions, the SkillMeter component, the stance picker, the rewired battle page, and update all callers.