# Home Page + Shuffle — Design

**Status:** Approved for planning (2026-06-14)
**Builds on:** catalog (TMDB discover/popular/trending, where-to-watch), taste layer (For-you, match, preferred_genres), watchlist.

## 1. Goal

Two connected pieces:
- **Shuffle** — a fast "what should we watch?" decision-helper for the undecided (solo, couples, groups). One tap → a few *watchable* options, filtered to the streaming services the viewer actually has. The signature feature.
- **Home page** — turn the bare landing page (hero + one rail) into a "there's always something to watch" hub that leads with Shuffle.

They ship as **two focused implementation plans** off this one design: **Shuffle first**, then the **home page** rails (which feature it).

## 2. Scope

**In:** the `/shuffle` page + home Shuffle hero; service / type / genre filters; "match my taste"; a 5-option reveal with "Shuffle again"; remembering chosen services; home rails (Shuffle hero, For-you preview, Trending, Popular movies, Popular TV, genre tiles).

**Out (future):** real-time **party/swipe** mode (its own spec); on-the-fly embedding-based taste ranking of arbitrary titles; runtime/era/mood filters; editorial/curated rows.

---

## 3. Shuffle

### 3.1 Surface
A `/shuffle` page (works signed-in **or** out — ideal for a group that isn't logged in) plus a prominent **"Can't decide? Shuffle"** button in the home hero.

### 3.2 Filters ("set the vibe")
- **Streaming services** *(the load-bearing filter)* — multi-select chips of the providers available in the viewer's **region**. Only titles available on the selected services are shuffled in. Selection is **remembered** (localStorage, keyed by region) so it persists between visits/shuffles.
- **Type** — Movie / TV / Surprise me (both).
- **Genre(s)** — optional multi-select (reuse the onboarding genre list).
- **Match my taste** *(signed in only)* — biases the candidate query toward the user's `preferred_genres` (falling back to their most-rated genres). Lightweight; no per-title embedding.

### 3.3 Region & providers
- **Region:** from the signed-in user's profile, else default `US` (same rule the where-to-watch island already uses).
- **Provider list:** TMDB `GET /watch/providers/movie?watch_region=<region>` → `{ provider_id, provider_name, logo_path }[]`, filtered to the common subscription services and sorted by `display_priority`. Cached.

### 3.4 Candidate selection
`shuffle({ region, services, mediaType, genres, matchTaste, userId? })`:
- TMDB `discover` per relevant media type with: `watch_region`, `with_watch_providers=<services joined with |>`, `with_watch_monetization_types=flatrate` (subscription), `with_genres=<genres joined with |>` (OR), `sort_by=popularity.desc`, `vote_count.gte=100`, and a **random page** (1..5) for variety.
- `matchTaste` on → use the user's `preferred_genres` (or top-rated genres) as `with_genres` when the user left genre unset.
- Mirror the chosen picks via `getOrCreateTitle` (gives poster + `watch/providers` metadata for the card), then **randomly sample 5**. "Shuffle again" re-rolls (new random page + sample).
- **Thin pool** (< a few results): return what there is plus a `broaden: true` flag so the UI nudges "try more services or fewer genres."

### 3.5 Reveal (5 option cards)
A brief spin, then **5 cards**, each: poster, title, year, the **where-to-watch logo(s)** among the viewer's selected services (reusing the existing region provider logic), and quick **Add to watchlist** + **Details** (→ title page). A **"Shuffle again"** button re-rolls.
- **Match %** is shown **opportunistically** — only for picks that already have an embedding (looked up via the existing `GET /api/v1/me/match` batch endpoint). Newly-mirrored picks are queued for background embedding (`after()`), so coverage grows over time. No blocking on-the-fly embedding.

### 3.6 API
- `GET /api/v1/shuffle/providers?region=US` (public, cached) → region provider list for the picker.
- `GET /api/v1/shuffle?services=8,337&type=movie&genres=28&matchTaste=1[&page=…]` (public; `matchTaste` only honored when signed in) → `{ picks: ShufflePick[], broaden: boolean }`. `ShufflePick = { tmdbId, mediaType, title, year, posterUrl, href, providers: {name,logoUrl}[] }`.

### 3.7 Components
`ServicePicker` (chips + localStorage), `ShuffleControls` (type/genre/match toggle + Shuffle button), `ShuffleSpinner` (reveal animation), `ShuffleResults` (5 cards reusing `MatchBadge` + where-to-watch logos), and the page shell `src/app/shuffle/page.tsx` (client-driven via React Query). Pure helpers: `sample(array, n)` and discover-param building.

---

## 4. Home page

A streaming-style vertical stack:

1. **Shuffle hero** — centerpiece: headline + "Can't decide? **Shuffle**" button → `/shuffle` (keep a smaller secondary "Browse" link). Replaces the current plain hero.
2. **For you** preview *(signed in)* — a rail of the top few `/api/v1/me/for-you` items + "See all" → `/for-you`. *(Signed out → a "Build your taste profile" / sign-in nudge.)* Client island.
3. **Trending this week** — keep (server-cached).
4. **Popular movies** + **Popular TV** — two server-cached rails (`tmdb.popular`).
5. **Browse by genre** — a row of genre tiles → `/movies?genre=<id>` (and `/tv`). Server-rendered from the genre list.

Rails reuse the existing `Rail` + `TitleCard`. Mostly server components; the For-you preview is a client island (keeps the page cacheable/user-independent).

---

## 5. Error handling & resilience
- Every TMDB-backed piece degrades to empty/graceful (the catalog already does this): a failed rail renders nothing or "unavailable"; a thin Shuffle pool shows the broaden nudge; the provider list falls back to a small built-in set if TMDB fails.
- Shuffle works fully signed-out; `matchTaste` and match % simply don't apply.

## 6. Testing
- **Pure:** `sample(array, n)` (size, no dups, subset), discover-param building (services → `with_watch_providers` `|`-join, genres `|`-join, monetization), provider-list mapping/filtering.
- **Service (live TMDB or mocked):** `shuffle()` returns ≤5 mirrored picks honoring the service/type/genre filters; `broaden` set when the pool is thin. (Mock TMDB to keep deterministic; the discover-param building is unit-tested separately.)
- Home rails are server-rendered compositions of existing tested pieces — covered by build + a light render check.

## 7. Decisions log
- **Service filter is mandatory to the value prop** (user, 2026-06-14) — suggestions must be watchable; built on TMDB `discover` `with_watch_providers` + `watch_region`.
- **5 options, not one** (user) — groups rally around a small choice set; "Shuffle again" re-rolls.
- **Set-the-vibe group mode for v1; party/swipe later** (user) — shared filters on one screen, no multi-account session needed now.
- **"Match my taste" = genre bias, not embedding rank** — per-title embeddings of arbitrary discover results are too slow for an instant shuffle; match % is shown opportunistically only where embeddings already exist.
- **Services remembered in localStorage** — works for signed-out groups; region from profile/US.

## 8. Out of scope
Party/swipe multiplayer, on-the-fly embedding taste ranking, runtime/era/mood filters, editorial rows, per-person taste blending.
