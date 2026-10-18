# Static Catalog Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve anonymous catalog pages from Vercel's cache with no per-request function, and move all per-user rendering to the browser.

**Architecture:** The root layout stops reading auth on the server (Clerk's header switch moves to a client component). Card marks, watched markers and watch progress come from one browser-side request (`/api/v1/me/card-keys`) through a React Query hook. Tier A pages read their data through `"use cache"` wrappers, get `generateStaticParams` samples so Next.js saves each URL after its first render, and are removed (with Tier B) from the Clerk middleware matcher. The canonical-host redirect moves to a platform-level redirect.

**Tech Stack:** Next.js 16.2.9 (`cacheComponents: true`), React Query (`@tanstack/react-query`), Clerk `@clerk/nextjs` 7.5.2, Vitest + Testing Library, Drizzle on CockroachDB.

**Spec:** `docs/superpowers/specs/2026-10-18-static-catalog-pages-design.md` (read it first; tiers, lifetimes and verification come from it)

## Global Constraints

- Tier A routes: `/`, `/title/[mediaType]/[idSlug]`, `/title/[mediaType]/[idSlug]/[episode]` (and their `og` routes), `/person/[idSlug]`, `/location/[id]`, `/source/[id]`, `/mood/[slug]`, `/mood/[slug]/tv`, `/moods`, `/privacy`, `/what-can-i-do`, `/guide`, `/shuffle`, `/for-you`, `/rank`.
- Tier B routes: `/tv`, `/movies`, `/find`, `/search`.
- No Tier A or Tier B server render may call `getCurrentProfile()`, Clerk `auth()`/`currentUser()`, `cookies()`, `headers()`, `connection()`, or read the clock outside `"use cache"`.
- A cached page must contain no per-user data. Per-user data only ever arrives through `/api/v1/me/*` from the browser.
- Lifetimes: title, episode, person, location, source, mood data `cacheLife("days")`; home hourly. Keep every existing `cacheLife("hours")` the spec lists (TV cast, next-episode, mood lists, failure paths). `src/services/public-config.ts` moves from `"hours"` to `"days"` (tags unchanged).
- Never use em dashes in any user-facing string or code comment.
- Commit with targeted `git add <paths>` only. Never commit `producthunt-launch-copy.md`. No Co-Authored-By or other trailers. Do not push.
- Vitest: `server-only` and `next/cache` are aliased to stubs (`vitest.config.ts`); `"use cache"` is a no-op in tests.

## Review Focus

1. A title or person TMDB no longer has: the page must return 404, not 500. Errors thrown inside `"use cache"` lose their prototype, so `instanceof TmdbError` fails across the boundary. Pinned in Task 4.
2. One browser, two accounts (sign out, sign in as someone else): the second account must never see the first account's marks. Pinned in Task 2 (query key includes the Clerk user id).
3. Clicking a heart or bookmark before the user's keys have loaded: no wrong toggle. Pinned in Task 2 (buttons disabled while loading).
4. A visitor whose timezone differs from the server's: date labels use the browser's date, and nothing date-dependent is rendered during server render (no hydration mismatch). Pinned in Task 4.
5. A signed-in user marks an episode watched in the season list: the progress line updates without a reload (shares the season list's query). Pinned in Task 5.

---

### Task 1: The card-keys endpoint

**Files:**
- Create: `src/lib/card-keys.ts`
- Create: `src/app/api/v1/me/card-keys/route.ts`
- Test: `src/lib/card-keys.test.ts`, `src/app/api/v1/me/card-keys/route.test.ts`

**Interfaces:**
- Produces (client-safe, no server imports):
  - `type CardKeyKind = "favourites" | "watchlist" | "watched"`
  - `interface CardKeys { signedIn: boolean; favourites: string[]; watchlist: string[]; watched: string[] }`
  - `const EMPTY_CARD_KEYS: CardKeys` (signedIn false, empty arrays)
  - `cardKey(mediaType: "movie" | "tv", tmdbId: number): string` returning `"movie:603"`
  - `withCardKey(keys: CardKeys, kind: CardKeyKind, key: string, on: boolean): CardKeys` (new object; idempotent; never duplicates)
- Produces: `GET /api/v1/me/card-keys` returning `CardKeys` JSON with header `Cache-Control: private, no-store`. Anonymous returns `EMPTY_CARD_KEYS` with status 200.
- Consumes: `getCurrentProfile()` (`src/services/profile.ts`), `listFavouriteKeys`, `listWatchlistKeys` (`src/services/user-catalog.ts`), `watchedTitleKeys` (`src/services/completion.ts`, returns a `Set`).

- [ ] **Step 1: Write the failing tests**

`src/lib/card-keys.test.ts`:
- `cardKey("movie", 603)` equals `"movie:603"`.
- `withCardKey(EMPTY_CARD_KEYS, "favourites", "movie:603", true).favourites` equals `["movie:603"]`, and the input object is unchanged.
- adding a key already present leaves the array length 1.
- `withCardKey(k, "watchlist", "tv:1396", false)` removes only that key.

`src/app/api/v1/me/card-keys/route.test.ts` (`vi.mock` the profile, user-catalog and completion modules, and `next/server`'s `connection` to a resolved no-op):
- anonymous: status 200, body equals `{ signedIn: false, favourites: [], watchlist: [], watched: [] }`, `Cache-Control` equals `private, no-store`.
- signed in with favourites `["movie:603"]`, watchlist `["tv:1396"]`, watched `new Set(["movie:550"])`: body equals `{ signedIn: true, favourites: ["movie:603"], watchlist: ["tv:1396"], watched: ["movie:550"] }`.

- [ ] **Step 2: Run, expect FAIL** (`npx vitest run src/lib/card-keys.test.ts src/app/api/v1/me/card-keys/route.test.ts`, modules not found)
- [ ] **Step 3: Implement both files.** The route calls `await connection()` first (it must never be prerendered), then the three reads in `Promise.all`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** `git add src/lib/card-keys.ts src/lib/card-keys.test.ts src/app/api/v1/me/card-keys` and `git commit -m "Add a card-keys endpoint for browser-side card marks"`

---

### Task 2: Card marks come from the browser everywhere

**Files:**
- Create: `src/components/catalog/useCardKeys.ts`, test `src/components/catalog/useCardKeys.test.tsx`
- Modify: `src/lib/favourite.ts`, `src/components/catalog/CardFavouriteButton.tsx`, `src/components/catalog/CardWatchlistButton.tsx`, `src/components/catalog/useTitleState.ts`, `src/components/catalog/TitleCard.tsx` (types only)
- Modify every caller of `cardActionContext` / `favouriteProp` / `watchlistProp`: `src/app/account/page.tsx`, `src/app/calendar/page.tsx`, `src/app/find/page.tsx`, `src/app/challenges/[slug]/page.tsx`, `src/app/location/[id]/page.tsx`, `src/app/movies/page.tsx`, `src/app/mood/[slug]/MoodView.tsx`, `src/app/source/[id]/page.tsx`, `src/app/search/page.tsx`, `src/app/tags/[slug]/page.tsx`, `src/app/tv/page.tsx`, `src/components/home/MoodRails.tsx`, `src/components/account/FranchiseCompletion.tsx`, plus any client caller `tsc` flags (for example `ForYouGrid`)
- Delete: `src/services/favourites.ts`

**Interfaces:**
- Consumes: Task 1's `CardKeys`, `CardKeyKind`, `withCardKey`, `EMPTY_CARD_KEYS`.
- Produces:
  - `src/lib/favourite.ts`: `interface CardTarget { mediaType: "movie" | "tv"; tmdbId: number }`, `type CardFavourite = CardTarget`, `type CardWatchlist = CardTarget`, `cardTarget(mediaType, tmdbId): CardTarget`. The `initial` and `signedIn` fields are gone.
  - `src/components/catalog/useCardKeys.ts` (`"use client"`): `CARD_KEYS_QUERY_PREFIX = ["me", "card-keys"] as const` and `useCardKeys(): { status: "loading" | "anonymous" | "ready"; has(kind: CardKeyKind, key: string): boolean; setKey(kind: CardKeyKind, key: string, on: boolean): void }`.

- [ ] **Step 1: Write the failing hook tests** (`renderHook` inside a fresh `QueryClientProvider`; `vi.mock("@clerk/nextjs")` to control `useAuth`; stub `fetch`):
  - `useAuth` not loaded: `status` is `"loading"`, `fetch` not called.
  - signed out: `status` is `"anonymous"`, `fetch` never called.
  - signed in as `user_a` with two hooks rendered in the same provider: `fetch` called exactly once with `/api/v1/me/card-keys`; after it resolves `status` is `"ready"` and `has("favourites", "movie:603")` is true.
  - `setKey("watchlist", "tv:1396", true)` makes `has("watchlist", "tv:1396")` true without another fetch.
  - re-render as `user_b`: a new fetch happens and `user_a`'s keys are not reported while it loads (query key includes the user id).
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement `useCardKeys`.** Clerk `useAuth()` gives `isLoaded`, `isSignedIn`, `userId`. React Query with key `[...CARD_KEYS_QUERY_PREFIX, userId]`, `enabled` only when signed in, `staleTime` 5 minutes, fetch through `meFetch` from `src/lib/me-client`. `setKey` uses `queryClient.setQueryData` with `withCardKey`.
- [ ] **Step 4: Rework both card buttons** to take `CardTarget` props and read state from `useCardKeys()`: disabled while `status === "loading"`; `"anonymous"` click goes to `/sign-in` as today; otherwise optimistic `setKey`, revert with `setKey(..., !next)` on error, same toasts as today.
- [ ] **Step 5: In `useTitleState.ts`,** every mutation that changes favourites, watchlist, rating or diary also invalidates `CARD_KEYS_QUERY_PREFIX` on success, so the title page's own controls keep the cards in sync.
- [ ] **Step 6: Replace every `favouriteProp(ctx, mt, id)` / `watchlistProp(...)` with `cardTarget(mt, id)`, drop each `cardActionContext()` call, delete `src/services/favourites.ts`.** Where a page used the context only for cards, also drop the import of `getCurrentProfile` if it becomes unused.
- [ ] **Step 7: Verify.** `npx vitest run src/components/catalog/useCardKeys.test.tsx` passes; `npx tsc --noEmit` clean; `npx eslint` clean on touched files; `rg "cardActionContext|favouriteProp|watchlistProp" src` returns nothing.
- [ ] **Step 8: Commit** the touched files with `git commit -m "Load card hearts and bookmarks from the browser"`

---

### Task 3: The layout reads nothing per request

**Files:**
- Create: `src/components/layout/HeaderAuth.tsx`
- Modify: `src/app/layout.tsx:120-129`, `src/components/layout/PageShell.tsx:3,44-48`, `src/services/public-config.ts:18,35`

**Interfaces:**
- Produces (`"use client"` file, importing `Show` and `SignInButton` from `@clerk/nextjs`, which resolves to Clerk's client build in a client file): `HeaderAuth()` rendering the sign-in button when signed out and `AccountAvatar` when signed in; `SignedInOnly({ children }: { children: React.ReactNode })`.

- [ ] **Step 1: Replace the layout's `actions` content with `<HeaderAuth />`** and PageShell's server `<Show when="signed-in">` with `<SignedInOnly>`. PageShell no longer imports `@clerk/nextjs`. Reserve the avatar's width while Clerk loads if the header visibly shifts (builder's call).
- [ ] **Step 2: Change both `cacheLife("hours")` calls in `public-config.ts` to `cacheLife("days")`**, keeping the `cacheTag` calls, and update the comments to say publishing revalidates by tag.
- [ ] **Step 3: Verify.** `npm run build` succeeds and the route table marks `/privacy`, `/moods`, `/what-can-i-do`, `/guide`, `/shuffle`, `/for-you` and `/rank` as `○` (static), where they were `◐` before. Paste the relevant route-table lines into the commit message body.
- [ ] **Step 4: Commit** `git add src/components/layout/HeaderAuth.tsx src/app/layout.tsx src/components/layout/PageShell.tsx src/services/public-config.ts` and `git commit -m "Decide the header's signed-in state in the browser"`

---

### Task 4: Cached catalog reads and browser-side dates

**Files:**
- Create: `src/services/cached-catalog.ts`, test `src/services/cached-catalog.test.ts`
- Create: `src/services/clock.ts`
- Create: `src/lib/today.ts`, test `src/lib/today.test.ts`
- Create: `src/components/ui/BrowserDate.tsx`, `src/components/catalog/UpcomingBadge.tsx`, test `src/components/catalog/UpcomingBadge.test.tsx`
- Modify: `src/components/catalog/TitleCard.tsx` (new optional `releaseDate` prop)

**Interfaces:**
- Produces:
  - `cachedTitle(mediaType: "movie" | "tv", tmdbId: number): Promise<TitleRow | null>` with `"use cache"`, `cacheLife("days")`, `cacheTag(\`title:${mediaType}:${tmdbId}\`)`. Calls `getOrCreateTitle(mediaType, tmdbId, false)`. Returns `null` when that throws a `TmdbError` with status 404 (checked inside the cached function, where the prototype is intact). Any other error is rethrown.
  - `cachedPerson(tmdbId: number): Promise<PersonRow | null>`, same rules, `cacheTag(\`person:${tmdbId}\`)`, wrapping `getOrCreatePerson(tmdbId, false)`.
  - `src/services/clock.ts`: `cachedTodayYmd(): Promise<string>` with `"use cache"`, `cacheLife("hours")`, returning the server's UTC date `YYYY-MM-DD`. For coarse values only (facts panel, "in theaters", seasonal moods).
  - `src/lib/today.ts`: `localTodayYmd(now?: Date): string`, the browser-local date as `YYYY-MM-DD`.
  - `useBrowserToday(): string | null` (in `src/components/ui/BrowserDate.tsx`, `"use client"`): `null` during server render and hydration, the local date after mount (via `useSyncExternalStore` or an effect).
  - `UpcomingBadge({ releaseDate }: { releaseDate: string | null })`: client; renders the same pill `TitleCard` uses for `upcoming`, with `upcomingLabel(releaseDate, new Date())` computed only after mount.
  - `TitleCard` gains `releaseDate?: string | null`; when given (and `upcoming` is not), it renders `<UpcomingBadge releaseDate={releaseDate} />` in the badge column.

- [ ] **Step 1: Write the failing tests**
  - `cached-catalog.test.ts` (`vi.mock("./catalog")`): returns the row on success; returns `null` when `getOrCreateTitle` rejects with `new TmdbError(404, "x")`; rethrows a `TmdbError(503)`; rethrows a plain `Error`; `getOrCreateTitle` called with `persist` `false`. Same four cases for `cachedPerson`.
  - `today.test.ts`: `localTodayYmd(new Date(2026, 0, 5, 23, 30))` equals `"2026-01-05"` (local, zero-padded).
  - `UpcomingBadge.test.tsx`: `renderToString(<UpcomingBadge releaseDate="2999-01-01" />)` contains no `"Jan 1, 2999"`; after `render(...)` and effects, the text `"Jan 1, 2999"` is shown; `releaseDate="2000-01-01"` renders nothing.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement the files above.**
- [ ] **Step 4: Run, expect PASS**; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** the new and modified files: `git commit -m "Add cached catalog reads and browser-side date helpers"`

---

### Task 5: The title and episode pages become fully cached

**Files:**
- Modify: `src/app/title/[mediaType]/[idSlug]/page.tsx`, `src/app/title/[mediaType]/[idSlug]/[episode]/page.tsx`
- Modify: `src/components/catalog/AiringBanner.tsx`; create `src/components/catalog/AiringBannerLabel.tsx`
- Modify: `src/components/catalog/WatchProgress.tsx` (becomes a client component), `src/lib/watch-progress.ts`, test `src/lib/watch-progress.test.ts`
- Modify: `src/components/catalog/MovieCollection.tsx`; create `src/components/catalog/CollectionWatched.tsx`
- Modify: `src/components/catalog/TitleActions.tsx` (computes `unreleased` itself), `src/components/catalog/SeasonsAccordion.tsx` (drops the `todayYmd` prop)

**Interfaces:**
- Consumes: Task 4's `cachedTitle`, `cachedTodayYmd`, `useBrowserToday`; Task 2's `useCardKeys`, `cardKey`.
- Produces:
  - `generateStaticParams()` on the title page returning `[{ mediaType: "movie", idSlug: "603-the-matrix-1999" }, { mediaType: "tv", idSlug: "1396-breaking-bad-2008" }]`, and on the episode page one sample for `1396` season 1 episode 1 (use the episode slug format that page already parses).
  - `src/lib/watch-progress.ts`: `watchProgressSummary(rows: { season: number; episode: number }[], seasons: SeasonSummary[]): { counted: number; total: number; pct: number; next: { season: number; episode: number } | null } | null` (the logic now inside `WatchProgress`, unchanged).
  - `WatchProgress({ tvId, seasons })` client: reads the existing query `["episode-watches", tvId]` (same key, URL and response type as `SeasonsAccordion.tsx:438`), enabled only when signed in.
  - `AiringBanner({ tvId })` server: gets `tvAiringInfo` as today, takes `today = await cachedTodayYmd()`, and looks up `broadcastFor(tvId, ep.airDate)` only when `ep.airDate` is `today` or the day after (keeps the earlier fix that avoids guide lookups for far-future dates). Passes `{ info, broadcast }` to `AiringBannerLabel`.
  - `AiringBannerLabel({ info, broadcast })` client: `airingLabel(info, browserToday)` after mount; shows the broadcast line only when `browserToday === ep.airDate`.
  - `CollectionWatched({ keys }: { keys: string[] })` client: `"n/total watched"` when signed in, nothing otherwise. A small client `SeenBadge({ itemKey })` replaces the server "Seen" badge on each collection card.

- [ ] **Step 1: Write the failing tests**
  - `watch-progress.test.ts`: `watchProgressSummary([], seasons)` is `null`; with seasons `[{seasonNumber:1, episodeCount:2},{seasonNumber:2, episodeCount:3}]` and rows `[{season:1,episode:1}]` returns `{ counted: 1, total: 5, pct: 20, next: { season: 1, episode: 2 } }`; a row for a removed episode (`{season:1, episode:9}`) is not counted; specials (season 0) are excluded from the total.
  - `WatchProgress` component test (QueryClientProvider pre-seeded with `["episode-watches", 1396]` data, signed-in `useAuth` mock): shows `"1 of 5 episodes"`; after `queryClient.setQueryData` adds a second watched episode, it shows `"2 of 5 episodes"` without a new fetch (Review Focus 5).
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Rework the title page.** Remove `getCurrentProfile`, the `after(onTitleViewed)` call and its import, and every `new Date()` / `Date.now()`. Use `cachedTitle` in both the page and `generateMetadata`; `null` means `notFound()`. `todayYmd` for `titleFacts` and `inTheaters` comes from `cachedTodayYmd()`. Pass `releaseDate` (not `unreleased`) to `TitleActions`. `TitleMatch` stays as is (it uses the title's database id, which is not per-user). Rework `WatchProgress`, `MovieCollection`, `AiringBanner`, `SeasonsAccordion` and `TitleActions` per the Interfaces block.
- [ ] **Step 4: Rework the episode page** to read through `cachedTitle` and add its `generateStaticParams`.
- [ ] **Step 5: Verify.** Tests pass; `npx tsc --noEmit` and `npx eslint` clean on touched files; `npm run build` marks both title routes `●` (prerendered with params), not `◐`.
- [ ] **Step 6: Commit** the touched files: `git commit -m "Serve title and episode pages fully from the cache"`

---

### Task 6: The person page becomes fully cached

**Files:**
- Modify: `src/app/person/[idSlug]/page.tsx`, `src/components/person/FilmographyGrid.tsx`, `src/components/person/PersonCompletion.tsx`
- Create: `src/lib/completion.ts`, test `src/lib/completion.test.ts`
- Modify: `src/services/completion.ts` (re-export or import the moved pure helpers)

**Interfaces:**
- Consumes: Task 4's `cachedPerson`, `useBrowserToday`; Task 2's `useCardKeys`.
- Produces:
  - `src/lib/completion.ts` (client-safe): the `CompletionItem` and `Progress` types, `progressFor(items, watched: Set<string>): Progress` (unchanged), and `releasedItems(items: CompletionItem[], todayYmd: string): CompletionItem[]` (now takes the date instead of reading the clock). `src/services/completion.ts` imports these instead of defining them.
  - `PersonCompletion({ sets })` client: receives the person's acting, directing and writing item sets from a cached server read (`personSets(personId)`), filters with `releasedItems(items, browserToday)` after mount, computes progress from `useCardKeys` watched keys, renders nothing when not signed in.
  - `FilmographyGrid` reads watched markers from `useCardKeys` instead of a `watchedKeys` prop.
  - `generateStaticParams()` on the person page returning one sample person (for example `[{ idSlug: "17419-bryan-cranston" }]`).

- [ ] **Step 1: Write the failing tests** in `completion.test.ts`: `releasedItems(items, "2026-10-18")` keeps undated items and items dated on or before that day, and drops `"2026-10-19"`; `progressFor` unchanged behaviour on a two-item set with one watched key.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Rework the page**: no `getCurrentProfile`, no `watchedTitleKeys`; `cachedPerson` in page and `generateMetadata` (`null` means `notFound()`); `PersonCompletion` and `FilmographyGrid` per the Interfaces block. Check every other caller of `releasedItems` (`rg "releasedItems" src`) and pass it a date.
- [ ] **Step 4: Verify.** Tests pass; tsc and eslint clean; `npm run build` marks `/person/[idSlug]` as `●`.
- [ ] **Step 5: Commit** the touched files: `git commit -m "Serve person pages fully from the cache"`

---

### Task 7: Location, source, mood and home pages become fully cached

**Files:**
- Modify: `src/app/location/[id]/page.tsx`, `src/app/source/[id]/page.tsx`, `src/app/mood/[slug]/page.tsx`, `src/app/mood/[slug]/tv/page.tsx`, `src/app/mood/[slug]/MoodView.tsx`, `src/components/home/MoodRails.tsx`, `src/app/page.tsx` (only if it reads the clock or user)

**Interfaces:**
- Consumes: Task 4's `cachedTodayYmd`, `TitleCard`'s `releaseDate` prop; Task 2's `cardTarget`.
- Produces: `generateStaticParams()` samples: location `[{ id: "Q1028" }]`, source `[{ id: "Q1985" }]` (any valid Q-id), mood one real slug from `src/lib/moods.ts` for both mood routes.

- [ ] **Step 1: Remove `connection()`** from the mood pages and `MoodRails`. `MoodRails` derives month and day-of-year from `await cachedTodayYmd()` (seasonal rotation may lag up to an hour, per spec).
- [ ] **Step 2: Replace `upcoming={upcomingLabel(...)}` with `releaseDate={...}`** on Tier A pages (`MoodView` and any on the home page), so the badge is computed in the browser.
- [ ] **Step 3: Add the `generateStaticParams` samples.**
- [ ] **Step 4: Verify.** tsc and eslint clean; full `npx vitest run` passes (apart from the known Storybook browser suites); `npm run build` marks `/`, `/location/[id]`, `/source/[id]`, `/mood/[slug]` and `/mood/[slug]/tv` as `○` or `●`, none `◐`.
- [ ] **Step 5: Commit** the touched files: `git commit -m "Serve location, source, mood and home pages fully from the cache"`

---

### Task 8: Middleware off the cached routes, redirect on the platform

**Files:**
- Modify: `src/proxy.ts`, `src/lib/canonical-host.ts`, `src/lib/canonical-host.test.ts`, `next.config.ts`
- Create: `src/proxy.test.ts`

**Interfaces:**
- Produces:
  - `src/lib/canonical-host.ts`: `canonicalRedirects(env: { VERCEL_ENV?: string; VERCEL_PROJECT_PRODUCTION_URL?: string }): Redirect[]` (the Next config `Redirect` type). Returns `[]` unless `VERCEL_ENV === "production"` and the production URL is set; otherwise one permanent redirect whose `has` matches a host ending in `.vercel.app`, whose `source` matches every path except `/api` and `/api/*`, and whose `destination` is `https://<production host>/<same path>`. Query strings are preserved by Next's redirect handling.
  - `next.config.ts`: `async redirects() { return canonicalRedirects(process.env); }`.
  - `src/proxy.ts`: the canonical-host block is removed (the platform redirect covers it); the blocked-agent check stays for routes still matched. The `matcher` excludes the Tier A and Tier B paths in Global Constraints and keeps everything else, including `/api/*` and the existing static-file exclusions.

- [ ] **Step 1: Write the failing tests**
  - `canonical-host.test.ts`: `canonicalRedirects({})` is `[]`; `canonicalRedirects({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "haystackk.com" })` is `[]`; production returns one redirect with `permanent: true`, a `has` host condition matching `reco-pink.vercel.app` and not `haystackk.com`, and a `destination` starting `https://haystackk.com/`; its `source` pattern does not match `/api/cron/x`. Remove the tests for the deleted `canonicalRedirectUrl`.
  - `proxy.test.ts`, using Next's experimental matcher helper from `next/experimental/testing/server` (use the name the installed Next 16.2.9 exports for proxy/middleware matching): matched: `/account`, `/watchlist`, `/calendar`, `/vote/abc`, `/api/v1/me/card-keys`, `/sign-in`; not matched: `/`, `/title/movie/603-the-matrix-1999`, `/title/tv/1396-x/s1e1`, `/person/17419-x`, `/location/Q1028`, `/source/Q1985`, `/mood/cozy`, `/moods`, `/privacy`, `/tv`, `/movies`, `/find`, `/search`.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** `canonicalRedirects`, the `next.config.ts` hook, and the narrowed matcher. Delete `canonicalRedirectUrl` and `productionHost` if nothing else uses them (`rg` first).
- [ ] **Step 4: Verify.** Tests pass; tsc and eslint clean; `npm run build` succeeds and the route table still shows the tiers from Tasks 3 to 7.
- [ ] **Step 5: Commit** the touched files: `git commit -m "Keep Clerk middleware off cached routes and redirect hosts on the platform"`

---

### Task 9: Verify before unpausing

No code. Run the spec's checks in order and record results in `handoff.md`.

- [ ] **Local production build** (`npm run build` then `npm start`, with the local test Clerk keys): run spec checks 4, 5 and 6 in the browser at `http://localhost:3000`. For check 6, fetch a title page's HTML with a signed-in session (`curl` with the session cookie, or view-source) and confirm none of the account's favourites appear in it.
- [ ] **Preview deployment** (the owner pushes the branch): spec checks 1, 2 and 3. For check 2, request one title URL twice with `curl -sI` and expect a cache-hit header on the second; confirm in runtime logs that the second request and requests to Tier A and B routes logged nothing.
- [ ] **Record** the results and the remaining production smoke steps (spec, "Right after unpausing") in a new `handoff.md` entry; commit `git add handoff.md` with `git commit -m "Record static catalog pages verification"`.
