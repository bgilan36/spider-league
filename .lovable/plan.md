# Cinematic Battle Scene

Turn the battle screen from "dice + HP bars" into a fight where the spiders visibly move, attack, and react. Same module powers live turn-based battles, auto-battles, and replays.

## Where it lives

```
src/components/battle/
  CombatStage.tsx            ← NEW. The arena: tokens, lunges, particles, FX.
  FighterToken.tsx           ← NEW. Circular masked photo + state (idle/hit/dead/winner).
  DamageFloat.tsx            ← NEW. Floating numbers, CRIT, MISS tags.
  HpBar.tsx                  ← NEW. Smooth drain + ghost trail + heartbeat pulse.
  effects/
    FangStrike.tsx           ← venom: green particles + lingering poison tick.
    WebShot.tsx              ← webcraft: silk strands + WRAPPED chip.
    SpeedBlur.tsx            ← speed: afterimage double-strike.
    HeavySlam.tsx            ← damage: starburst + screen shake.
  combatFx.ts                ← NEW. Pure helpers: pickAttackStyle(stats), reduced-motion check, timing constants.
```

A new `<CombatStage>` is the only piece needed by callers. It accepts:

```ts
{ mySpider, opponentSpider, myHp, opponentHp,
  events: CombatEvent[],   // attacker, defender, damage, crit, dodged, finisher
  onEventComplete?: (i) => void,
  onSkip?: () => void,     // shows the Skip button when provided
  reducedMotion?: boolean  // overrides prefers-reduced-motion if needed
}
```

Events are consumed one at a time; the stage drives all animations, then fires `onEventComplete` so the host can advance the recap.

## Wire-in points

```text
src/components/battle/InteractiveBattleArena.tsx   ← live turn battle
   replaces the current static spider-headers row.
   Each new completed turn pushes an event onto a local queue.

src/components/BattleArena.tsx                     ← auto-battle / quick battle
   replaces the bespoke dice-and-HP scene with <CombatStage>
   playing one event per round at a metered pace.

src/components/BattleDetailsModal.tsx              ← replay
   if the battle has battle_log.turns, build the event list
   and play it inside <CombatStage> with a Skip-to-end button.

src/components/BattleRecapModal.tsx                ← post-battle recap
   reuses <CombatStage> to replay the final 1-3 hits + finisher.
```

The existing `SkillMeter`, dice readout, and victory share card stay where they are — the new stage replaces only the visual arena.

## Attack style → stat mapping

`pickAttackStyle(spider)` returns the dominant style from `{venom, webcraft, speed, damage}` (highest stat, ties broken venom > webcraft > speed > damage):

| Style       | Trigger stat | Visuals |
| ----------- | ------------ | ------- |
| `fang`      | venom        | Lunge → fang glint → green droplet particles → 3-tick poison drip on defender HP bar (small dmg per second for 2s) |
| `web`       | webcraft     | Silk strands shoot from attacker, wrap defender, `WRAPPED` chip for 1.5s, defender wobble |
| `blur`      | speed        | Attacker dashes with afterimage trail, hits twice (two damage floats back-to-back) |
| `slam`      | damage       | Heavy lunge → impact starburst → screen shake + dust particles |

Every style still uses the lunge → strike → snap-back base motion; the style only swaps the strike FX + post-hit overlay.

## Per-hit choreography (~800ms baseline)

```text
 0ms   attacker token: ease-in translate toward defender + scale 1 → 1.15
180ms  strike frame: style-specific FX overlay fires
220ms  defender: red flash + shake(8px) + knockback translate
240ms  damage float spawns above defender, rises 40px, fades
320ms  attacker: snap back to home (ease-out)
500ms  HP bar drains smoothly to new value; ghost trail lags 250ms behind
800ms  onEventComplete()

CRIT: extend to 1100ms; damage float is larger + gold; global time
       dilation slows next 200ms to 0.5x via CSS animation-duration.

DODGE: skip strike + damage; defender does a 120ms sidestep,
       'MISS!' tag floats above attacker.
```

## Juice details

- HP drain: `<HpBar>` keeps two layered bars — the front bar tweens immediately, the back "ghost" bar tweens with `transition-delay: 250ms` so the recent damage is visible as a fading sliver.
- Heartbeat: when either side ≤ 25% HP, both HP bars get `animate-[heartbeat_1.2s_ease-in-out_infinite]` and the stage gets a dimming vignette via a fixed inset overlay with radial gradient.
- Damage numbers: portal-rendered absolute spans above the defender token, animated with framer-motion (transform + opacity only).
- Web background: subtle SVG cobweb pattern at 6% opacity behind the tokens; dust particles only spawn on slam impacts (8 transient divs, transform-only, GC'd at end of animation).

## Finisher

When the event marks `finisher: true`:

1. Stage swaps to slow-mo (CSS var `--combat-speed: 0.5`).
2. Full-screen white flash (200ms opacity 0→0.6→0).
3. Loser token rotates 35° + translates 12px down + filter grayscale(1) over 600ms; HP bar empties fully.
4. Winner token does a single scale 1 → 1.1 → 1 pulse with a soft golden glow.
5. After 1200ms, existing victory card slides in (unchanged content).

## Performance + accessibility

- Animations only use `transform`, `opacity`, and `filter`. Heartbeat uses transform-only. No layout reads in the per-frame loop.
- All FX componenets unmount after their animation ends (`onAnimationComplete`) so the DOM stays small.
- `combatFx.ts` exports `useReducedMotion()` (matchMedia hook); when true:
  - Tokens fade in/out instead of moving.
  - Damage numbers appear and fade with no rise.
  - No screen shake, no particles, no time dilation.
  - Finisher = fade winner to bright, loser to gray, then card.
- The Skip button is always rendered in the top-right of `<CombatStage>` when `onSkip` is provided, even mid-animation. Hitting it cancels in-flight timers and flushes `onEventComplete` for all remaining events.

## Tech choices

- Framer Motion is already in the dep tree (used elsewhere) — used for token tweens, damage floats, finisher orchestration.
- No new runtime deps. SVG cobweb + particle divs are inline.
- Timing constants live in `combatFx.ts` so the recap modal can run the same sequence at a faster pace.

## Out of scope (callable in follow-ups)

- New backend fields on `battles`. The stage reads what's already in `battle_log` / turn `result_payload` (attacker_name, defender_name, damage, is_critical, dodged). Where the server doesn't currently mark a finisher, the stage infers it from "defender HP after this hit ≤ 0".
- Sound. Easy to layer on later — `combatFx.ts` exposes a no-op `playSfx(name)`.
