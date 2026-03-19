# Unified Combat Hub — Above-the-Fold Redesign

## Current Layout (lines 913-924)

```text
┌────────────────────────────┬──────────────────────┐
│  WeeklyEligibleSpiders     │  SpiderSkirmishCard   │
│  (7 cols)                  │  ActiveChallengesPreview│
│                            │  (5 cols)             │
└────────────────────────────┴──────────────────────┘
```

Skirmishes and Battles sit in a stacked column on the right, visually disconnected — they look like two unrelated widgets.

## Proposed Layout

Merge Skirmishes and Battles into a single **"Combat Hub"** card on the right side, using tabs to switch between them. The weekly roster stays on the left.

```text
┌────────────────────────────┬──────────────────────┐
│  WeeklyEligibleSpiders     │  ┌─ COMBAT HUB ────┐ │
│  (7 cols)                  │  │ [Skirmish][Battle]│ │
│                            │  │                   │ │
│                            │  │ (tab content)     │ │
│                            │  └───────────────────┘ │
│                            │  (5 cols)              │
└────────────────────────────┴────────────────────────┘
```

### Combat Hub Design

- **Single Card** with a shared header: "Combat" or "Combat Hub"
- **Two tabs**: "Skirmish" and "Battles"
  - **Skirmish tab**: Renders the existing `SpiderSkirmishCard` content (matchup, swap, start button, daily usage)
  - **Battles tab**: Renders the existing `ActiveChallengesPreview` content (open challenges, your active challenges, cancel/accept flows)
- Subtle visual cues on each tab label:
  - Skirmish tab: `Bug` icon + blue accent
  - Battles tab: `Sword` icon + red accent
- Active tab gets a colored underline matching its accent color

### Why This Works

- Reduces vertical scroll by combining two stacked sections into one tabbed card
- Makes it immediately clear that skirmishes and battles are two modes of the same "combat" system
- Keeps each mode's full functionality intact — just wrapped in tabs instead of separate cards
- Matches the unified "Combat Activity" feed pattern already established below the fold

## Technical Steps

1. **Create `CombatHub.tsx**` — a new wrapper component containing:
  - A `Tabs` component (from shadcn/ui) with two `TabsTrigger`s ("Skirmish" with Bug icon, "Battles" with Sword icon)
  - `TabsContent` for skirmish renders `<SpiderSkirmishCard />`
  - `TabsContent` for battles renders `<ActiveChallengesPreview />`
  - Styled with a single Card wrapper and colored tab indicators
2. **Update `src/pages/Index.tsx**` (lines 915-924):
  - Replace the separate `<SpiderSkirmishCard />` and `<ActiveChallengesPreview />` with `<CombatHub />`
  - Remove individual imports if no longer used elsewhere

## Files Modified

- `src/components/CombatHub.tsx` — new file
- `src/pages/Index.tsx` — swap right-column content to `<CombatHub />`

 below are modifications to the plan that I want. Make sure that when another user has an active challenge that you can accept, that it's pretty obvious in the combat hub ( not hidden behind the battle tab ). When there's no active challenges, prioritize the user's attention to the start skirmish so they have some kind of activity to do that's engaging every time that they log into the app. this will help with daily active user metrics 