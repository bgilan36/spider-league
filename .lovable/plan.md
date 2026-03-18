

## Problem

The project is a **Vite + React Router** app (uses `BrowserRouter`, `react-router-dom`, `vite.config.ts`) but was incorrectly reconfigured to build with **Next.js** (`next build`, `next dev`). Lovable does not support Next.js — it requires Vite. This is why:

1. `build:dev` script is missing from `package.json`
2. Even if added, `next build` would fail because the app architecture (React Router, no `pages/` routing logic) is incompatible with Next.js

## Plan

**Revert `package.json` scripts back to Vite:**

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "preview": "vite preview",
  "lint": "eslint .",
  "typecheck": "tsc -p tsconfig.typecheck.json --noEmit",
  "test": "node --test src/lib/*.test.js"
}
```

**Remove unnecessary Next.js artifacts** (optional cleanup):
- `next.config.mjs`, `next-env.d.ts`, `pages/` directory can be deleted since they serve no purpose in a Vite app
- Remove `next` from dependencies in `package.json`

**Restore `tsconfig.json`** to point at `tsconfig.app.json` (Vite-compatible config) instead of Next.js plugin config.

This will restore the preview build immediately.

