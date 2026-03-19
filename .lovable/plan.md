

# Plan: New User Excitement & DAU Boost

## Overview

Two features to make new users' first minutes exciting and give returning users a reason to open the app daily.

---

## Feature 1: First Skirmish Guided Banner

After onboarding closes, show a pulsing animated banner that guides the user into their very first skirmish. Disappears permanently once they complete one.

### Steps
1. **Migration**: Add `has_completed_first_skirmish boolean default false` to `profile_settings`.
2. **New `src/components/FirstSkirmishBanner.tsx`**: Animated, dismissible banner with a CTA that scrolls to Combat Hub. Only shown when flag is `false`.
3. **Update `src/pages/Index.tsx`**: Query the flag, render banner above Combat Hub. After first skirmish completes, update the flag and hide the banner.
4. **Update `src/components/OnboardingModal.tsx`**: "Enter the Arena" callback triggers auto-scroll to Combat Hub area.

### Files
- Migration (alter `profile_settings`)
- `src/components/FirstSkirmishBanner.tsx` — new
- `src/pages/Index.tsx` — wire banner + flag query
- `src/components/OnboardingModal.tsx` — minor callback update

---

## Feature 2: Welcome Back Daily Reward

When a returning user opens the app for the first time that day, show an animated welcome-back moment with bonus XP tied to their login streak.

### Steps
1. **Update `src/hooks/useLoginStreak.ts`**: Calculate and award `dailyBonusXp` (5 XP base + streak multiplier) when `isNewDay` is true.
2. **Update `src/components/LoginStreakDisplay.tsx`**: When `justUpdated` is true, show a richer "Welcome Back!" animation highlighting XP earned and streak bonus.

### Files
- `src/hooks/useLoginStreak.ts` — add daily XP reward logic
- `src/components/LoginStreakDisplay.tsx` — enhanced welcome-back display

---

## Implementation Order
1. First Skirmish Banner (highest new-user impact)
2. Welcome Back Daily Reward (DAU driver)

