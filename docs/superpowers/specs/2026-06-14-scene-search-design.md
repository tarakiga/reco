# "Describe a Scene" Search — Design

**Date:** 2026-06-14
**Status:** Approved (pending spec review)

## Goal

Let a user find a movie or TV show by **describing a scene or plot they remember**
("a giant squid attacks a cruise ship") instead of typing its title. Return a
ranked shortlist of plausible matches with a match %, so the user recognises the
one they meant.

## Approach

Reuse the existing Voyage + pgvector pipeline that already powers the taste /
For-you feature. Semantic search is a near-copy of For-you's nearest-neighbour
query, but ranked against a **query-text vector** instead of the user's taste
vector.

Two pieces of work:

1. **Corpus backfill** — embed ~20,000 titles so there is a library worth
   searching (today only 160 titles are embedded).
2. **Search** — embed the user's description and return the nearest titles.

This is **phase 1** (lean shortlist). Phase 2 (richer plot text and/or an LLM
re-rank for sharper specific-scene hits) is explicitly **out of scope** here and
recorded at the end.

## Architecture

```
[Home CTA SceneSearchBar] ──submit──▶ /find?q=...
[/find SceneSearchBar]     ──submit──▶ /find?q=...
                                          │
                       /find (server) reads ?q ──▶ searchByScene(q)
                                          │              │
                                          │      embed q as "query" (Voyage)
                                          │              │
                                          │      ORDER BY embedding <=> qVec
                                          │      (title_embeddings ⋈ titles)
                                          ▼              ▼
                              ranked poster cards + match %
```

### Searchable corpus

- Source: TMDB **popular movies** (pages 1–500 ≈ 10k) + **popular TV**
  (pages 1–500 ≈ 10k) → ~20k titles. Both movies and TV are in scope.
- Each title is mirrored via the existing `getOrCreateTitle(mediaType, tmdbId)`
  (writes the title row + its overview / keywords / cast metadata), then embedded
  via the existing batched `embedMissing(limit, embedder)`.
- Stored in the existing `title_embeddings` table (Voyage `voyage-3.5`, 1024-d,
  HNSW cosine index). No new tables.
- **Idempotent:** `getOrCreateTitle` skips titles already mirrored; `embedMissing`
  skips titles whose descriptor hash is unchanged. Safe to run in chunks / resume.

### Components

**1. Backfill script — `scripts/backfill-catalog.mjs`**
- Walks TMDB popular movie + TV pages up to a configurable page count
  (default 500 each), calling `getOrCreateTitle` for every result.
- After mirroring, embeds in batches by calling `embedMissing` until no titles
  remain unembedded (respecting Voyage's per-minute limit via the existing
  ≤100-per-request batching).
- Logs progress (pages walked, titles mirrored, embeddings written). Re-runnable.
- One-time cost: pennies of Voyage usage; ~20–40 min of TMDB fetching. Run as a
  local background job, not via the scheduled cron.

**2. Search service — `src/services/scene-search.ts`**
- `searchByScene(query: string, opts?: { limit?: number; mediaType?: "movie" | "tv" }): Promise<SceneResult[]>`
- Embeds `query` with input type **`"query"`** (titles were embedded as
  `"document"`; Voyage retrieval quality depends on this distinction).
- Raw SQL mirroring `for-you.ts`:
  `SELECT t.*, 1 - (te.embedding <=> ${qVec}::vector) AS cos
   FROM title_embeddings te JOIN titles t ON t.id = te.title_id
   [WHERE t.media_type = ...]
   ORDER BY te.embedding <=> ${qVec}::vector LIMIT ${limit}`
- Maps `cos` to a 0–100 **match %** via the existing calibrated ramp in
  `src/lib/taste/match.ts`.
- `SceneResult`: `{ titleId, tmdbId, mediaType, title, year, posterUrl, href, match }`.
- **Guardrails:**
  - Trim the query; require ≥ 3 words (return empty otherwise — too vague).
  - Drop results below a similarity floor (`cos < 0.15`, tuned during build) so a
    nonsense query yields "nothing matched" rather than noise.
  - Cap `limit` (default 20, max 40).

**3. API — `GET /api/v1/search/scene?q=...&limit=20`**
- Public (search needs no auth). Thin wrapper over `searchByScene`.
- Returns `{ results: SceneResult[] }`. Validates `q` (string, length cap) and
  `limit` (coerced int, clamped) with Zod.
- Primarily for tests and future client use; the `/find` page renders results
  server-side via the service directly (see below).

**4. Shared UI — `src/components/search/SceneSearchBar.tsx` (client)**
- A multi-line input ("Describe a scene you remember…") + Search button.
- Props: `{ initialQuery?: string }`. On submit, navigates to
  `/find?q=${encodeURIComponent(query)}` via `useRouter().push`.
- Disables submit when the query is empty/whitespace.
- Used in **two** places: the home CTA card and the `/find` page header.

**5. Page — `src/app/find/page.tsx` (server)**
- Reads `searchParams.q`.
- Renders `<SceneSearchBar initialQuery={q} />` at the top.
- If `q` is present: calls `searchByScene(q)` server-side and renders a ranked
  poster grid (`TitleCard` + a match badge, mirroring the For-you grid). SSR
  results → URL is shareable/bookmarkable.
- States: no query → a short prompt/examples; query with no matches → "Nothing
  matched — try describing it differently"; query with matches → the grid.
- Metadata title: "Find a movie".

**6. Home CTA — in `src/app/page.tsx`**
- A second CTA card directly **under** the existing Shuffle "Can't decide?" card:
  heading *"Can't remember the name?"*, subtext, and an inline `<SceneSearchBar />`.
- Submitting navigates to `/find?q=...`, where results render. (No inline results
  on the home page itself.)

### Navigation entry

The `/find` page is reachable via the home CTA. (A nav-menu link is optional and
can be added later via the config nav, like Shuffle was — not required for v1.)

## Data flow (search)

1. User types a description into a `SceneSearchBar` (home or `/find`).
2. Submit → `router.push("/find?q=<encoded>")`.
3. `/find` server component reads `q`, calls `searchByScene(q)`.
4. `searchByScene` embeds `q` as `"query"`, runs the ANN SQL, maps cos→match%,
   applies guardrails.
5. Page renders the pre-filled bar + ranked poster cards.

## Error handling

- Voyage/embedding failure in `searchByScene`: catch, return `[]`; the page shows
  the "nothing matched" state (never a 500 to the user).
- TMDB failure during backfill: skip that title, continue; the script is
  re-runnable to fill gaps.
- Empty/too-short query: return `[]` without calling Voyage.

## Testing

- **`scene-search.test.ts`** (FakeEmbedder, deterministic): seed a few titles +
  embeddings, assert a query returns titles ordered by cosine similarity, that
  `mediaType` filtering works, and that a too-short query returns `[]`.
- **API contract test:** valid `q` → 200 with `results`; missing/short `q` →
  empty results; `limit` clamping.
- **Backfill idempotency:** running the embed step twice writes no duplicate
  embeddings (descriptor-hash skip).
- Match-% mapping reuses the already-tested `match.ts` ramp.

## Out of scope (phase 2, later)

- Enriching titles with fuller plot text (e.g. Wikipedia plot sections) for
  sharper specific-scene recall.
- An LLM re-rank/confirmation pass over the top candidates.
- Hybrid blending with keyword/full-text search.
- A persistent nav link (can be added via config nav when desired).

## Open questions

None blocking. Route name `/find` and movies-plus-TV scope are confirmed.
