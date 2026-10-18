# Static catalog pages design

**Date:** 2026-10-18
**Status:** Draft, awaiting owner approval (builder check done)

## Why

The site is paused. A residential-proxy botnet crawled the catalog for days and
the billing period reached $120. The usage breakdown shows the shape of the
problem:

| Meter | Amount | Cost |
| --- | --- | --- |
| Observability Events | 42.8M events | $51.37 (add-on, now switched off) |
| CDN Requests | 17.7M | $18.97 |
| Fluid Active CPU | 3d 1h | $12.37 |
| Function Invocations | 17.5M | $10.53 |
| Fluid Provisioned Memory | 618 GB-hrs | $8.92 |
| Build CPU Minutes | 3d 4h | $7.56 (build machine now Standard) |
| Fast Origin Transfer | 54.7 GB | $7.27 |

Function invocations (17.5M) almost exactly equal CDN requests (17.7M): nearly
every request ran a function, including repeat visits to the same page. A bot
never received a free cached page. Two settings changes already removed about
half the bill. This design removes most of the function group (invocations,
CPU, memory, origin transfer: about $39 of the $120).

## Root cause (verified by reading the code, 2026-10-18)

1. **The root layout makes every route dynamic.** `src/app/layout.tsx:122,125`
   and `src/components/layout/PageShell.tsx:44` use Clerk's `<Show>`. In a
   server component that resolves to Clerk's server `Show`, which calls
   `auth()` and reads request headers. It sits inside the `<Suspense>` that
   wraps every page (`layout.tsx:109`), so every route renders per request,
   even `/privacy`.
2. **Catalog pages read the signed-in user on the server.** Mostly through
   `cardActionContext()` (`src/services/favourites.ts:17`), which looks up the
   user to pre-fill each card's heart and bookmark. Also `getCurrentProfile()`
   on the title and person pages, the server-side `WatchProgress`,
   `MovieCollection`'s watched count, and person-page watched markers and
   completion.
3. **The Clerk middleware runs on every page request** (`src/proxy.ts`
   matcher). It cannot simply be narrowed today because of points 1 and 2:
   Clerk's `auth()` throws on any route the middleware does not cover
   (`handoff.md` records this as a rejected change, for exactly this reason).
4. **Some page data reads are uncached or time-dependent.** `getOrCreateTitle`
   and `getOrCreatePerson` do an uncached database read and call `Date.now()`;
   the title page computes "today" with `new Date()` at render time.

## Goal

An anonymous visitor (human or bot) requesting a catalog page gets a page
served from Vercel's cache with no function invocation, after the first render
of that URL. Repeat visits, and the extra background requests the browser makes
for each page, cost nothing beyond the CDN request itself.

Signed-in users keep every personal feature they have today. Their personal
marks (hearts, bookmarks, watched markers, watch progress, match percentage)
load from the browser a moment after the page, instead of arriving with it.
**Owner decision, 2026-10-18:** this short delay is acceptable.

## Non-goals

- Reducing CDN request charges. Every request that reaches Vercel is billed as
  a CDN request no matter what the app does. Only the firewall reduces that.
- Stopping the first render of a never-before-seen URL. A crawler walking
  distinct pages still pays one render per page per cache lifetime. The page
  cache lifetime (below) bounds how often that recurs.
- Pages that are inherently personal or live: `/account*`, `/watchlist`,
  `/wrapped`, `/tags/[slug]`, `/challenges*`, `/vote/[slug]`, `/calendar`
  (uses the user's region), `/list/[idSlug]`, `/sign-in`, `/sign-up`, and all
  `/api/*` routes. These keep the middleware and stay as they are.
- New personalization features, or changes to existing ones beyond where they
  load.
- The pre-existing soft-404 issue recorded in `handoff.md`.

## Anti-goals (failures even if the bill drops)

- **Any user's personal data inside a cached page.** A cached page is shared
  by everyone. If one signed-in user's marks were rendered into it, every
  visitor would see them. Cached pages must contain no per-user data at all.
- Signing in, signing out, or the header's account button breaking on any
  page.
- Search engines losing pages. Page URLs, titles, metadata, and status codes
  stay the same.
- Cron jobs or API calls breaking. `/api/*` keeps the middleware unchanged.

## Route tiers

**Tier A: fully cached, removed from the middleware.** These must render with
no per-request reads at all:

- `/` (home)
- `/title/[mediaType]/[idSlug]`, its episode page `/title/.../[episode]`, and
  their OG image routes
- `/person/[idSlug]`, `/location/[id]`, `/source/[id]`
- `/mood/[slug]`, `/mood/[slug]/tv`, `/moods`
- `/privacy`, `/what-can-i-do`, `/guide`, `/shuffle`, `/for-you`, `/rank`
  (these already have no server-side user reads; they become cached once the
  layout is fixed)

**Tier B: still rendered per request, but removed from the middleware.** These
read the URL query string, so they cannot be fully cached, but they stop
reading the user on the server, which removes the middleware invocation and the
user lookup from every request:

- `/tv`, `/movies`, `/find`, `/search`

**Tier C: unchanged.** Everything in the non-goals list above.

## The changes

1. **Make the root layout and page shell read nothing per request.** Replace
   the server `<Show>` in `layout.tsx` and `PageShell.tsx` with Clerk's
   client-side equivalent (a small client component), so the header decides
   between the sign-in button and the account avatar in the browser.
2. **Card marks come from the browser.** Add one endpoint that returns the
   signed-in user's favourite, watchlist, and watched title keys
   (`"mediaType:tmdbId"` strings; anonymous callers get a "not signed in"
   answer, never an error). A client-side provider in the layout fetches it
   once when the browser knows the user is signed in, and the card heart and
   bookmark buttons read their state from it and update it when toggled. Pages
   stop calling `cardActionContext()`. For anonymous visitors, the provider
   makes no request at all, and the buttons behave as they do today for a
   signed-out user.
3. **Other server-side personal pieces on Tier A pages move to the browser.**
   `WatchProgress` (the existing `/api/v1/me/episodes` endpoint already serves
   watched episodes), `MovieCollection`'s watched count, person-page watched
   markers and person completion (all from the watched keys in change 2), and
   the home page's `MoodRails` card marks.
4. **Page views never write to the database.** Title and person pages always
   read in non-persisting mode. Signed-in actions (rating, watchlisting,
   favouriting) already create the database row through their own API routes
   when needed. The page-view no-op `after(onTitleViewed)` is removed.
5. **Cache the page data reads.** The title and person reads (database plus
   TMDB fallback) go behind `"use cache"`, shared by the page and its
   metadata, so the page can be prerendered and the duplicate read in
   `generateMetadata` disappears.
6. **No request-time dates in Tier A server renders.** Anything relative to
   "today" either renders in the browser from a date the server provides, or
   is allowed to be stale for up to the page cache lifetime. **My call:** the
   airing banner's "Today / Tomorrow / weekday" label and upcoming-release
   badges render in the browser, which also makes them correct in the visitor's
   own timezone (today they use server time). Coarse values such as "in
   theaters" and the home page's seasonal mood rotation may be up to the cache
   lifetime stale.
7. **Narrow the middleware matcher** to exclude Tier A and Tier B routes.
   Before that, move the two other jobs the middleware does so excluded routes
   keep them:
   - **Canonical-host redirect** (`*.vercel.app` hosts to the production
     domain) moves to a platform-level redirect in the Next config, added only
     for production builds and still skipping `/api/*`. Platform redirects run
     at the edge and invoke no function.
   - **Blocked agents** (`Lightpanda`) move to a Vercel Firewall rule (a
     dashboard step for the owner). The code check stays for the routes that
     still run the middleware.

## Page cache lifetime

With `cacheComponents`, a page refreshes as often as the shortest-lived cached
piece inside it. A visit after that lifetime serves the cached page immediately
and refreshes it in the background with one render.

**My call:** keep the hourly lifetimes the code already chose deliberately,
and do not lengthen them to make pages daily:

- TV cast and next-episode data stay hourly (the code comments ask for cast
  edits and airing changes to show the same day).
- Mood title lists stay hourly.
- A Wikidata or TMDB failure keeps its short (hours) lifetime, so a page
  rendered during an outage recovers within hours instead of a day.

Pages containing those pieces therefore refresh hourly, which is fine: the
refresh only happens when the same URL is visited again after an hour, and a
crawler walking distinct URLs rarely does.

One exception the builder should make: the header brand name, nav links and ad
configuration (`src/services/public-config.ts`, hourly today) may move to a
daily lifetime, because publishing in the admin already clears them by tag
immediately. Otherwise they would force every page in Tier A to refresh hourly
for no benefit.

## Left to the builder

- How Next.js 16 with `cacheComponents` prerenders dynamic-parameter routes on
  first request. It may require `generateStaticParams` to return at least one
  entry. Check the current Next.js documentation; do not guess.
- The exact Clerk client component for the header swap, and whether it needs a
  placeholder to avoid layout shift while Clerk loads in the browser.
- The match-percentage island (`TitleMatch`) is keyed by the database title id.
  If a title is no longer persisted on view, it may have no id; make the island
  work by media type and TMDB id if needed.
- The endpoint's name and response shape, and how the provider refreshes after
  a toggle, sign-in, or sign-out.
- Which exact `cacheLife` profiles implement the lifetimes above.
- The precise matcher expression. It must exclude exactly the Tier A and B
  paths and keep everything else, including `/api/*`.

## How we know it worked (before unpausing)

Production Clerk only signs people in on `haystackk.com`, so preview
deployments (on `*.vercel.app`) cannot test signed-in behaviour. Local
development uses a separate Clerk test instance that works on `localhost`.
**My call:** split the checks by where they can actually run.

**On a preview deployment (anonymous, proves the cost fix):**

1. The build output lists every Tier A route as fully static or incrementally
   cached, with no request-time holes.
2. Requesting the same title URL twice anonymously: the second response
   carries a cache-hit header and produces no runtime log entry.
3. Requests to Tier A and B routes produce no middleware log entries.

**On a local production build (`next build` then `next start`, signed in with
the test Clerk instance):**

4. A signed-in walkthrough on a title, person, and location page: hearts,
   bookmarks, watched markers, watch progress, match percentage, rating and
   watchlist actions all show the correct state after load. Signed-out, the
   heart and bookmark lead to sign-in as today.
5. Sign in and sign out from a Tier A page both work, and the header updates.
6. No user data appears in the HTML of a Tier A page while signed in (fetch the
   page's HTML with a signed-in session and search it for the account's
   marks; they must only arrive through the browser-side request).

**In the repo:**

7. Unit tests cover the new endpoint and the client-side mark state; the full
   test suite and the build pass.

**Right after unpausing (production smoke, with Vercel's instant rollback to
the previous deployment ready):** sign in on `haystackk.com`, repeat a short
version of check 4, confirm the `*.vercel.app` host still redirects to
`haystackk.com` on a Tier A route, and watch the function-invocation count fall
relative to CDN requests over the following hours.

## Expected effect

Repeat views and the browser's background page requests stop invoking
functions. Removing the middleware from Tier A and B removes one invocation
from every request to those routes. The first render of each distinct URL
remains, once per cache lifetime. The two settings already changed removed
about $59 of the $120 period (Observability and the build machine). This
change targets most of the remaining function group (about $39), less the
first render of each distinct URL. CDN request charges remain and are the
firewall's job.
