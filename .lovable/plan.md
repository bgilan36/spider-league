# Fix the open security warnings

The latest scan still has these open:

1. **Skirmish step builds commands as it runs.** The "start a skirmish" step in the database picks which stat to boost and then builds a command from that stat's name. The names come from a fixed list, so the risk is low today, but the scan is right that the pattern is risky.
   - Fix: replace the built command with a fixed choice for each of the six stats (hit points, damage, speed, defense, venom, webcraft). Skirmishes play exactly as before, including the 3-per-day limit.

2. **Old battle screen moves spider ownership directly.** One older battle screen, still reachable from Home, hands the losing spider to the winner itself. It skips the checked transfer step that the rest of the game uses.
   - Fix: stop that screen from changing ownership. Only Capture Battles, which go through the server with both players' consent, can move a spider. If the screen still offers a capture, send it through the checked transfer step instead.
   - Then check that the server rules block any direct change of a spider's owner.

3. **Profile wall posts are readable by any signed-in player.** Confirm whether this is intended, since walls are public on profiles. If it is, mark it as intentional. If not, limit reading to the wall owner, the person who wrote the post, and that profile's visitors as the app shows today, and keep demo and real players apart.

4. **Settings only you can change** (the app can't change these for you):
   - Turn on leaked-password protection.
   - Shorten how long sign-in codes stay valid.
   - Upgrade the database to get security patches.
   I'll give you the exact steps.

5. Run the scan again, mark the fixed items as resolved, and check that skirmishes and battles still work.

## Technical details
- Migration: `CREATE OR REPLACE FUNCTION start_spider_skirmish` with the `EXECUTE format(... %I ...)` read and update replaced by a static `CASE` / per-column `UPDATE`. Keep SECURITY DEFINER with the `auth.uid()` checks.
- `BattleArena.tsx`: remove `.update({ owner_id })` and use `transfer_spider_ownership` RPC or the `challenge` edge function. Check that RLS/column grants prevent `owner_id` updates from clients.
- Read the `profile_wall_posts` policies before changing them.
