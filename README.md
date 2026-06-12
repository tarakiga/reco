# reco (working codename)

Community entertainment platform — catalog, watchlists, ratings; community and AI layers to follow.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Neon + Clerk values.
3. `npm run db:push` (after Plan 1 Task 13 exists)
4. `npm run dev`

## Docs
- Spec: `docs/superpowers/specs/2026-06-12-reco-v1-design.md`
- Plans: `docs/superpowers/plans/`
- Progress: `task-list.md`, `handoff.md`

## Commands
- `npm run dev` / `npm run build`
- `npm run test` (Vitest) / `npm run test:e2e` (Playwright)
- `npm run storybook`
