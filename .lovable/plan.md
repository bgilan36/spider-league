

# Combine Battles & Skirmishes into a Unified Combat Activity Feed

## What Changes

The current "Recent Battles and Skirmishes" section already merges both into one chronological list, but the presentation treats them almost identically -- the only differentiator is a small badge in the corner. The goal is to make the section feel more cohesive while still making it obvious which entries are battles vs skirmishes.

## Design

**Unified section with tab filters** at the top:
- Three filter pills: **All** | **Battles** | **Skirmishes**
- Default to "All" (current merged behavior)
- Clicking a filter shows only that type

**Visual differentiation per card** (subtle but clear):
- **Battles**: Left border accent in red/orange (`border-l-4 border-red-500`), small Sword icon + "Battle" label, and a subtle "Stakes: Spider Transfer" note below the date
- **Skirmishes**: Left border accent in blue/cyan (`border-l-4 border-primary`), small Bug icon + "Skirmish" label, and "Stakes: XP Only" note below the date
- Remove the current tooltip-wrapped Badge in favor of the inline icon+label -- simpler and always visible

**Shared layout** stays the same: Spider A thumbnail (with trophy if winner) -- VS -- Spider B thumbnail -- metadata column on the right.

## Technical Steps

1. **Add filter state** to Index.tsx: `const [combatFilter, setCombatFilter] = useState<'all' | 'battle' | 'skirmish'>('all')`
2. **Add filter pills** below the section header -- three small buttons in a `bg-muted rounded-lg p-1` container (matching the leaderboard toggle style)
3. **Filter the displayed list**: `recentBattles.filter(c => combatFilter === 'all' || c.mode === combatFilter)`
4. **Restyle each card**: Replace the tooltip badge with a left border color + small inline icon/label. Add a one-line "stakes" descriptor
5. **Update section title** to "Combat Activity" (shorter, more unified feel)

## Files Modified

- `src/pages/Index.tsx` -- filter state, filter UI, card restyling (all within the existing Recent Battles section, ~lines 930-1082)

