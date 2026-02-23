# Spider League

Rebuilt from Lovable onto a production-ready stack:

- Next.js
- React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase

## Local Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Scripts

- `npm run dev`: start Next.js dev server
- `npm run build`: production build
- `npm run start`: run production server
- `npm run lint`: lint source files
- `npm run typecheck`: TypeScript checks

## Notes on the Migration

- Existing React Router routes are preserved inside a Next.js catch-all page for fast parity.
- Supabase integration and current app functionality are retained.
- UX improvements added in this migration:
  - Skip-to-content keyboard accessibility link
  - Route change screen reader announcements
  - Automatic scroll reset on navigation
  - Duplicate notification listener removed

## Spider Skirmish

- New one-click `Spider Skirmish` CTA appears above the fold on the dashboard.
- Matchmaking picks a relatively even opponent from another user using power/stat similarity with widening match bands.
- Skirmishes run server-side and return deterministic turn logs for replay.
- Winners gain small bounded spider stat improvements and user XP.
- Existing weekly winner-take-all battle mode is unchanged.
