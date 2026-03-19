

# Onboarding Flow for New Users

## Overview

Carousel-style onboarding modal for first-time logins. Walks users through Spider League mechanics and gets them excited to jump in immediately with their starter spider.

## Tracking Completion

Add `has_completed_onboarding boolean default false` to `profile_settings`. Set to `true` when user finishes or dismisses.

## Onboarding Slides (4 total)

1. **Welcome** -- Logo + "Welcome to Spider League!" Brief tagline about collecting and battling real spiders.
2. **Upload & Collect** -- Camera icon. Find real spiders, photograph them, upload to generate fighters with unique stats and rarity.
3. **Combat** -- Sword/Bug icons. Skirmishes = daily practice (XP, no risk). Battles = high stakes (winner takes the loser's spider).
4. **Get Started** -- Show the user's starter spider with its image, name, and stats. "You already have your first spider -- jump into a Skirmish right now!" Big "Enter the Arena" CTA button that closes modal and marks onboarding complete.

Dot indicators at bottom + Next/Back buttons. Dismissing via X also marks complete.

## Technical Steps

1. **Migration**: `ALTER TABLE profile_settings ADD COLUMN has_completed_onboarding boolean DEFAULT false`
2. **Create `src/components/OnboardingModal.tsx`**: `Dialog` + `Carousel` (embla). Slide 4 fetches user's spider to display. On complete, updates `profile_settings`.
3. **Wire into `src/pages/Index.tsx`**: After auth, query `has_completed_onboarding`. If `false`, show modal.

## Files

- Migration (add column)
- `src/components/OnboardingModal.tsx` -- new
- `src/pages/Index.tsx` -- onboarding check + render

