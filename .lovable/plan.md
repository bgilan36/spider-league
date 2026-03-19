

# Plan: New User Excitement & DAU Boost

## Overview

Two features to make new users' first minutes exciting and give returning users a reason to open the app daily.

---

## Feature 1: First Skirmish Guided Banner ✅

After onboarding closes, show a pulsing animated banner that guides the user into their very first skirmish. Disappears permanently once they complete one.

### Implemented
- Migration: Added `has_completed_first_skirmish` to `profile_settings`
- `src/components/FirstSkirmishBanner.tsx` — animated banner with CTA
- `src/pages/Index.tsx` — queries flag, renders banner, auto-scrolls to Combat Hub after onboarding

---

## Feature 2: Welcome Back Daily Reward ✅

When a returning user opens the app for the first time that day, show an animated welcome-back moment with bonus XP tied to their login streak.

### Implemented
- `src/hooks/useLoginStreak.ts` — awards daily XP (5 base + 1/streak day, max 15)
- `src/components/LoginStreakDisplay.tsx` — "Welcome back! +XP" animation on new day
- `src/pages/Index.tsx` — LoginStreakDisplay rendered below header
