# Taste Onboarding — Design

**Status:** Approved for planning (2026-06-14)
**Builds on:** Phase 3a taste foundation (`2026-06-14-phase3a-taste-foundation-design.md`) — embeddings, `recomputeTaste`, ratings, the `/for-you` cold-start gate.

## 1. Goal

Turn the `/for-you` cold-start wall ("rate 5 to unlock") into a delightful, guided **"Build your taste profile"** flow that seeds a new user's taste vector in under a minute, then reveals their personalized feed. Quality bar: Fortune-500-grade polish (clear progress, fast tap-to-like, full accessibility, premium mobile).

## 2. Flow

A dismissible **full-screen modal** over the page, two steps + a finish moment:

1. **Pick your vibes** — tap **≥3 genres** from a visual grid. Scopes step 2 to recognizable titles and is saved as a lasting profile preference.
2. **Tap what you love** — a blended poster grid of acclaimed/popular titles **from the chosen genres** (TMDB discover, quality-filtered). Tap to "love"; a live counter unlocks **Continue at 10**. A search box finds specific favorites. An optional secondary "✕ not for me" captures a few negatives.
3. **Finish** — "Building your taste profile…" → one write → the modal closes and the For-you feed (now unlocked) renders.

Selections are **buffered client-side**; nothing is written until Finish. "Skip for now" is available on every step (closes the modal, no writes).

## 3. Data model

- **Likes → `ratings` score 5; dislikes → score 1.** Reuses the existing ratings table, so onboarding directly feeds the taste vector and clears the cold-start gate (`ratedCount ≥ 5`). No new rating concept.
- **`profiles.preferred_genres integer[]`** (new, nullable) — the chosen TMDB genre ids. Persisted for future feed biasing; used now to scope step 2.
- One batch write at Finish; the taste vector is recomputed **once** (not per tap).

## 4. API

- **`GET /api/v1/onboarding/genres`** (public, cached) — combined, de-duped movie+tv genre list `{ id, name }[]` from `tmdb.genres`.
- **`GET /api/v1/onboarding/picks?genres=28,878&page=1`** (public, cached) — quality-filtered candidate titles for the chosen genres via `tmdb.discover` (`with_genres`, `vote_count.gte`, sort by popularity), blended across movie+tv and deduped → `{ tmdbId, mediaType, title, year, posterUrl }[]`. "Load more" paginates.
- **In-modal search** reuses the existing `GET /api/v1/search` (titles only).
- **`POST /api/v1/me/onboarding`** (authed; 401 if signed out) — body (Zod-validated): `{ genres: number[], likes: TitleRef[], dislikes: TitleRef[] }` where `TitleRef = { mediaType: "movie"|"tv", tmdbId: number }`. Caps: ≤30 genres, ≤80 likes, ≤40 dislikes. For each like/dislike: `getOrCreateTitle` → `embedTitle` → upsert a `ratings` row (5 / 1). Save `preferred_genres`. Then `recomputeTaste(profile.id)` once. Returns `{ ratedCount }`. Best-effort per title (a single TMDB/embedding failure skips that title, never fails the whole request).

## 5. Components

- **`TasteOnboarding.tsx`** (client) — the full-screen modal shell: step state, three selection buffers (`Set<genreId>`, `Set<titleKey>` likes, `Set<titleKey>` dislikes), `role="dialog"` + `aria-modal`, focus trap, Esc-to-close (discards), return focus to trigger, sticky progress header + action footer.
- **`OnboardingGenreStep.tsx`** — genre toggle grid (React Query → `/onboarding/genres`).
- **`OnboardingTitleStep.tsx`** — paged poster grid (React Query → `/onboarding/picks`) + search (`/api/v1/search`); selectable `OnboardingPoster` (a `<button>`, not a link, toggling love/none; long-press or a small ✕ for "not for me"); live "N selected" region.
- **`OnboardingFinishing.tsx`** — posts to `/me/onboarding`, shows the building animation, on success invalidates the `["for-you"]` query and closes.
- **For-you entry point** — the cold-start `EmptyState` gains a primary **"Build your taste profile"** button that opens the modal (open-state managed in a small client wrapper on the For-you page). Signed-out users instead get a **"Sign in to get started"** CTA.

Grids: `grid-cols-2` (mobile) → `sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`. Selected = accent ring + check badge; unselected = subtle border.

## 6. Engine fit

Onboarding likes become embedded, rated titles, so `recomputeTaste` produces a real taste vector and `/for-you` unlocks immediately. Titles are embedded in the batch endpoint (Voyage in prod, `FakeEmbedder` locally/test). `preferred_genres` is stored now; biasing the candidate pool by it is a later enhancement (out of scope here).

## 7. Error handling & resilience

- Batch endpoint is best-effort per title and Zod-validated; auth-gated (401 signed out). If `recomputeTaste` itself fails, return 500 and the client offers "Try again" (buffered selections are preserved).
- `picks`/`genres`/`search` failures show an inline retry/empty state; the user can still proceed with whatever loaded.
- Closing mid-flow discards buffers (intentional — "skip for now"); no partial writes.

## 8. Accessibility & polish

`role="dialog"`/`aria-modal`, focus trap + restore, Esc to close, body scroll lock; posters and genres are real `<button>`s toggled by Enter/Space; the selection counter is an `aria-live` region; visible focus rings; reduced-motion-friendly transitions. Premium touches: smooth step transitions, sticky footer with live progress, disabled-until-threshold Continue, and a brief "Building your taste profile…" reveal.

## 9. Testing

- **Pure:** `blendPicks` (merge/dedupe movie+tv discover results, drop already-rated), onboarding payload Zod schema (min/max bounds).
- **Service (live Neon + `FakeEmbedder`, `__vitest__` isolation):** the onboarding batch — given genres + likes/dislikes, it writes the ratings (5/1), saves `preferred_genres`, recomputes taste, and returns the correct `ratedCount`; partial failure (one bad tmdbId) still records the rest.
- **Component:** selection-buffer logic (toggle love/dislike/none; threshold gating) via testing-library.

## 10. Decisions log

- **Likes = 5★ ratings, dislikes = 1★** (user decision, 2026-06-14) — reuses ratings, auto-clears cold-start, no new signal type.
- **Full-screen modal, 2-col mobile grids** (user decision) — premium feel with room for poster walls.
- **Genres first, tap-to-like, single total target (~10)** — higher completion than rate-one-by-one with per-genre quotas; shown titles are always recognizable.
- **Buffer then one batch write** — avoids 10× taste recomputes and partial state.

## 11. Out of scope

Auto-popup onboarding; a separate star-rating step (likes are the ratings); editing `preferred_genres` elsewhere; biasing the For-you pool by `preferred_genres`; re-onboarding/redo flows; importing taste from external services (that's a later Phase 3 slice).
