# reco — Handoff Log

Append an entry after each completed task: what was done, decisions made, where to pick up.

---

## 2026-06-12 — T1 Scaffold + T2 Repo hygiene

- Next.js 16.2.9 scaffolded (TS, App Router, Tailwind v4, ESLint, src dir, @/* alias, npm).
- Env pattern: `.env.example` tracked with placeholders; `.env*` gitignored (with `!.env.example` negation if needed).
- README, task-list.md, handoff.md created.
- Pick up at: T3 Vitest + cn() helper (see plan).

## 2026-06-13 — T3 through T12 complete (subagent-driven, reviewed)

- T3: Vitest (jsdom) + cn() helper (clsx + tailwind-merge); tsconfig types ["node", "vitest/globals"].
- T4: Tailwind v4 @theme token layer in globals.css (dark cinema palette, AAA contrast verified); unused scaffold SVGs removed.
- T5: Storybook 10.4.4 (@storybook/nextjs-vite) + addon-vitest browser project in vitest.config.ts; preview imports globals.css, dark default background.
- T6-T11: Component library, each TDD + story: Button (variants/sizes/loading), Input, Select, Badge, Skeleton, EmptyState, Tabs, Modal (escape/overlay close), Toast (provider + hook + 5s auto-dismiss).
- T12: PageShell (sticky header, nav, actions/footer slots) wired into app layout with ToastProvider; interim brand.ts/nav.ts single-source modules (Plan 2 makes them config-driven).
- State: 37 tests green, tsc clean, next build green, branch plan-1-foundation.
- BLOCKED at T13/T14: need owner-provided Clerk keys + Neon DATABASE_URL in .env.local (copy .env.example). Drizzle-kit also reads .env — put DATABASE_URL in both. Run CREATE EXTENSION IF NOT EXISTS vector; on the Neon DB once.
- Pick up at: T13 Clerk auth (plan task 13) once keys exist.

## 2026-06-13 — T13-T16 complete: Plan 1 DONE

- T13: Clerk v7 auth (proxy.ts — Next 16 convention; Show components replace SignedIn/SignedOut).
- T14: Drizzle + Neon, profiles schema pushed; pgvector confirmed enabled.
- T15: usernameBase + ensureProfile/getCurrentProfile (server-only), home page greets by username.
- T16: Playwright smoke (app shell landmarks, Clerk sign-in renders).
- State: 41 Vitest + 2 Playwright green, tsc clean, build green.
- Next: Plan 2 (config system + admin UI) — needs writing; see docs/superpowers/specs/2026-06-12-reco-v1-design.md sections 4.1/5.

## 2026-06-13 — T8: Public config API + cached helpers — Plan 2a DONE

- Model: `config_options`/`content_blocks` = working copy; publishing snapshots monotonically into `config_versions`; public reads serve the latest snapshot via `src/services/public-config.ts` — functions tagged `config:<entityType>:<key>` (e.g. `config:options_namespace:nav`), busted by the publish route's `revalidateTag("config:options_namespace:nav", "default")`. Tag strings are byte-identical on both sides.
- Cache mechanism: Next.js 16 `"use cache"` directive + `cacheTag()` (requires `cacheComponents: true` in next.config.ts). `unstable_cache` is deprecated in Next.js 16.
- Public API: `GET /api/v1/config/[namespace]` — unauthenticated, returns `{namespace, options:[]}` (empty safe default when unpublished).
- Rollback fix (B1): delete + insert in `rollbackOptionsNamespace` wrapped in `db.batch([deleteStmt, insertStmt])` — atomic on neon-http (implicit transaction). Audit write remains outside batch.
- jsonError fix (B2): `issues` key omitted from response when undefined — explicit conditional in `src/lib/api.ts`.
- Layout: added `<Suspense>` wrapper around `<PageShell>` in root layout to satisfy `cacheComponents` PPR requirements for auth-accessing Clerk components.
- State: 59 tests green, tsc clean, lint clean, build green (exit 0). First admin must be promoted via `npm run promote -- <username>`.
- Pick up at: Plan 2b (admin UI — to be planned).

## 2026-06-13 — Plan 2b: Admin UI DONE

- Plan 2b (admin UI) complete — guarded `/admin` (editor+), Options manager (CRUD/reorder/enable-toggle/publish/version/rollback), Content blocks with Tiptap rich-text editor, Audit log view, config-driven brand+nav via `npm run seed:site` (with safe fallbacks).
- Note: admin e2e covers the anonymous-guard security boundary; the signed-in admin flow (actual CRUD/publish through the UI) needs Clerk testing tokens and is verified manually for now.
- Note React Query + Tiptap added.
- Plan 2 (2a + 2b) DONE. Next: Plan 3 (catalog MVP — TMDB title/person pages, cast search, streaming availability, watchlists, ratings — to be planned).
