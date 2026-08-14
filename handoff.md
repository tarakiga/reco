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

## 2026-06-13 — Plan 3b: Watchlists, ratings, browse, region wiring DONE

- Plan 3b (user data + catalog personalization) complete: watchlist/ratings schema + services, authed me/* API, StarRating, TitleActions island (watchlist+rating on PPR title pages), /watchlist page, browse /movies+/tv with genre/year filters, region wiring (WhereToWatchClient personalizes availability per signed-in user's region via a client island; RegionSelect on /watchlist; default US).
- WhereToWatch refactored: pure `WhereToWatchView` shared by both the server wrapper and the `WhereToWatchClient` island — zero markup duplication. Title page stays PPR `◐` (region resolved client-side, no dynamic server cost).
- Rating scale = 5 whole stars. Signed-in flows verified via anon-path e2e + manual (Clerk testing tokens not configured).
- **Plan 3 (3a+3b) DONE → catalog MVP complete.**
- Next: Phase 2 (community: reviews/lists/profiles/follows) or Phase 3 (AI taste layer: embeddings/match scores/semantic search) — see spec.

## 2026-06-13 — Plan 3a: Catalog core DONE

- Plan 3a (catalog read surfaces) complete: TMDB v3 client + lazy mirror (titles/people), search, movie/tv detail (cast/trailer/where-to-watch), person filmography, trending home, header search, TMDB+JustWatch footer attribution.
- Routes: `/title/[mediaType]/[id]-[slug]`, `/person/[id]-[slug]`.
- Home page (`src/app/page.tsx`) uses `"use cache"` directive on `getTrending()` — cacheable under PPR/cacheComponents with no dynamic penalty.
- Header: compact GET search form (`/search?q=...`) added via PageShell's new optional `search` prop.
- Footer attribution (TMDB TOS requirement): "This product uses the TMDB API but is not endorsed or certified by TMDB." + "Streaming data powered by JustWatch." in PageShell footer slot.
- Region hardcoded "US" pending profile wiring (Plan 3b).
- Plain `<img>` for TMDB CDN (no next/image — avoids domain config).
- e2e hits live TMDB (network-dependent — may be flaky in CI without internet).
- Next: Plan 3b (watchlists, ratings, browse filters).

## 2026-08-03: Mood TV tabs, card art, Wikidata hardening, Gemini paused

### ACTION REQUIRED, do not forget

**1. Gemini is OFF in production AND preview. This is temporary.**

`GEMINI_API_KEY` was deleted from Vercel (commit `a1caf02` redeployed to pick it up).
It was a single variable scoped to both Preview and Production, so removing it took
both, not just production. The key itself is NOT lost: it is still in local
`.env.local`, and local dev is unaffected.

Three features are silently degraded while it is off, all by design (each call site
guards on the key and falls back):

| Feature | Code | Fallback while off |
| --- | --- | --- |
| Scene-query expansion on `/find` | `src/lib/scene/expand.ts` | Searches literal words, weaker recall on vague queries |
| Title spell-correction | `src/lib/search/correct.ts` | Misspellings no longer auto-correct |
| Episode guessing | `src/services/episode-search.ts` (`guessEpisodes`) | Keyword matching over synopses only |

To restore, from the project root:

```
npx vercel env add GEMINI_API_KEY production     # paste value from .env.local
npx vercel env add GEMINI_API_KEY preview        # if previews should have it too
```

Then deploy (any push, or `git commit --allow-empty`), because env changes only
apply to new deployments.

**The cost cause is now fixed, so re-enabling is safe.** `expandSceneQuery` was the
only Gemini call with no caching, and it sat on `/find`, the endpoint being
crawled. It now has `cacheLife("weeks")` like `correctTitleQuery` and
`guessEpisodes`. The whole `sceneSearch` pipeline is cached too, so a repeated
query no longer buys a fresh Voyage embedding and vector scan either.

**2. Vercel WAF rule is live in LOG mode, needs a decision.**

Rule `rule_rate_limit_find_bC4fFw` ("Rate limit find"): `path starts with /find`,
60 req / 60s per IP, action = **log only, blocks nothing**. Published 2026-08-03.

Review at
`https://vercel.com/tars-projects-8492f88e/reco/firewall/traffic?filter=rule_rate_limit_find_bC4fFw`
then either tighten to enforcement:

```
npx vercel firewall rules edit "Rate limit find" --rate-limit-action deny --yes
npx vercel firewall publish --yes
```

or disable it if robots.txt already solved the traffic:

```
npx vercel firewall rules disable "Rate limit find" --yes
```

Context: `/find` was taking ~6,980 hits in 6 hours (~1.7 req/s) across 12,216
distinct paths, driving ~27,400 function invocations/24h. Nearly all were
`cache=HIT`, so the pages were cheap, but every request still invokes Clerk
middleware. Crawler traffic, not users.

### Shipped this session

- **Mood TV tabs.** Every mood now has Movies/TV tabs. `/mood/[slug]` stays movies
  (existing links unaffected), `/mood/[slug]/tv` is new. 22 of 23 moods have curated
  `manualTv` lists; only `festive-favourites` is movie-only and renders no tabs.
  New: `manualTv`, `blurbTv`, `backdrop` on `Mood`; `hasTvTab`/`moodBlurb` helpers;
  `MoodTabs`; shared `MoodView`; pure `toMoodCard` mapper in `src/lib/tmdb/`.
- **TV moods are curated-only, and must stay that way.** TMDB's TV genre vocabulary
  has no Romance, Horror, Thriller, Action, Adventure or Sci-Fi, and it silently
  ignores unknown genre ids rather than erroring. Measured: the existing queries
  return 0 to 2 results against `/discover/tv` (date-night 2, spooky-season 0,
  summer-blockbusters 0, inspirational 1). Discover fill is guarded to movies only
  in `getMoodTitles`. Do not "fix" this by adding a `queryTv`.
- **Mood card backdrop art.** Each card sits on a film backdrop with the card colour
  as a scrim: solid across the left half, fading to 50% by the right edge. Stored as
  a TMDB path (not a title id) so `/moods` stays static; resolving 23 ids would add
  23 API calls to a page that makes none.
- **New mood: UK classics** (25 films, 30 shows). Renames: Classic Hollywood to
  Classics, Family movie night to Family night, B-movie mashups to B-movie/TV
  mashups. Slugs unchanged so URLs still work.
- **Wikidata hardening** (commit `1f6ea79`). All four callers now share
  `src/lib/wikidata.ts`: 5s `AbortSignal.timeout`, failure logging, and one accurate
  user-agent. Added `cacheLife("days")` to all five cached Wikidata functions, which
  previously had `cacheTag` but no `cacheLife` and so inherited the default ~15 min
  revalidate. Two callers were also still sending a stale
  `reco-pink.vercel.app` user-agent, which matters because Wikidata throttles per
  user-agent.
- **robots.txt** now disallows `/find` and `/rank` (result pages, unbounded URLs).

### Known issues, not fixed

- **Soft 404s app-wide.** `notFound()` returns HTTP 200 with the not-found body,
  because `cacheComponents: true` commits the prerendered shell before the dynamic
  part streams. Affects `/title/...`, bad mood slugs, `/mood/festive-favourites/tv`.
  Pre-existing, not caused by the mood work. Reordering the gate before
  `connection()` does NOT fix it (tried and reverted). Bad for SEO.
- **Do not narrow the Clerk middleware matcher** in `src/proxy.ts` to cut invocations.
  `cardActionContext()` calls `getCurrentProfile()` which calls Clerk `auth()`, and it
  runs on public pages (`/find`, mood pages). Narrowing breaks favourites and
  watchlist marking there. This was considered and rejected.
- **`episodeIndex`** (`src/services/episode-search.ts:24`) has `cacheTag` but no
  `cacheLife`, the same gap just fixed on the Wikidata services.
- **`/api/v1/*` has no rate limiting.** Deliberately deferred so the `/find` WAF rule
  can be evaluated on its own first.
- 2 pre-existing test failures on main, unrelated: `site-config.test.ts > nav falls
  back when namespace empty`, and `PageShell.stories.tsx > Default` (Storybook missing
  ClerkProvider).
