# Phase 3a: Taste Foundation — Design

**Status:** Approved for planning (2026-06-14)
**Phase:** 3 (AI taste layer), slice 1 of 4.
**Predecessors:** v1 (Phase 0 + 1) shipped — see `2026-06-12-reco-v1-design.md`.

## 1. Background & goal

reco's differentiator is taste-aware recommendation. This slice builds the **engine**: embed titles, derive a per-user taste vector from existing rating/watchlist signals, and surface a **% match** on titles plus a **"For you"** feed. It is the foundation the remaining Phase 3 slices build on.

**Phase 3 decomposition (for context; only slice 1 is specced here):**
1. **Taste foundation** — title embeddings, taste vector, match scores, For-you feed. ← this doc
2. Semantic / vibe search — natural-language query over the same embeddings.
3. Concierge — conversational LLM assistant (uses match + search as tools).
4. Taste import — bootstrap taste from a Letterboxd/IMDb export.

Everything hangs off **title embeddings**, so slice 1 goes first and ships value alone.

## 2. Scope

**In:** pgvector setup; title embedding pipeline; user taste vector; % match on the title detail page and the For-you feed; a `/for-you` page; a candidate pool built from TMDB popular/top-rated titles plus per-user "similar" expansion; a batch match endpoint + match badge usable on cards where an embedding exists.

**Out (later slices / fast-follow):** natural-language semantic search; concierge; taste import; showing match on *every* browse/search card regardless of embedding coverage; multi-region taste; explanation text ("because you liked…").

## 3. Stack additions

- **pgvector** extension on Neon (existing DB).
- **Voyage AI** `voyage-3.5` embeddings (1024 dims), called through an injected `Embedder` interface. New env: `VOYAGE_API_KEY`.
- **Vercel Cron** for the popular-pool job. New env: `CRON_SECRET`.
- Next.js `after()` for non-blocking background work (embed-on-mirror, per-user similar, taste recompute).

## 4. Data architecture

### 4.1 Schema (append to `src/db/schema.ts`)

```
title_embeddings
  title_id        uuid  PK  → titles.id  (on delete cascade)
  embedding       vector(1024)  not null
  model           text  not null            -- e.g. "voyage-3.5"
  descriptor_hash text  not null            -- sha256 of the embedded text; skip re-embed when unchanged
  built_at        timestamptz not null default now()
  -- HNSW index on (embedding vector_cosine_ops)

user_taste
  user_id     uuid PK → profiles.id (on delete cascade)
  embedding   vector(1024)  not null
  rated_count integer not null default 0    -- # of signal titles that fed the vector
  built_at    timestamptz not null default now()
```

pgvector types aren't first-class in Drizzle; declare the column via `customType` (raw `vector(1024)`), and create the extension + HNSW index in the migration (drizzle-kit custom SQL, consistent with prior plans' direct-DDL fallback).

### 4.2 Candidate pool

Match scoring needs titles to score, but we only embed titles that exist locally. Two feeders keep the pool broad and personal:
- **Popular pool (breadth):** a cron mirrors + embeds TMDB `popular`/`top_rated` movies and TV in batches (target ~1–2k rows, refreshed/extended over time).
- **Per-user similar (relevance):** when a user rates/watchlists a title, enqueue mirror+embed of that title's TMDB `recommendations`/`similar` so the feed has fresh, on-taste candidates.

## 5. Components & data flow

### 5.1 Descriptor synthesis — `src/lib/taste/descriptor.ts` (pure)

`buildTasteDescriptor(meta, mediaType): string` — a compact, embedding-friendly text from title, decade, genres, **keywords**, top cast, director/creator, original language, and tone words derived from genres. Requires adding `keywords` to the `getTitle` `append_to_response` (rich taste signal). Pure and unit-tested.

### 5.2 Embedder — `src/lib/taste/embedder.ts`

`interface Embedder { embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> }`. `VoyageEmbedder` (real) + `FakeEmbedder` (deterministic, hash-seeded vectors) for tests. All call sites take the interface so tests never hit the network.

### 5.3 Embedding service — `src/services/title-embeddings.ts` (live-db tested)

`embedTitle(titleId, embedder)` — load title → build descriptor → if `descriptor_hash` unchanged, no-op; else embed (`document`) and upsert. Idempotent. `embedMissing(limit, embedder)` for backfill/cron.

### 5.4 Taste service — `src/services/taste.ts` (live-db tested)

`recomputeTaste(userId, ...)` — join the user's ratings + watchlist to `title_embeddings`, weight each (5★ +1.0, 4★ +0.5, 3★ +0.1, 2★ −0.5, 1★ −1.0; watched +0.3, watching +0.2, want_to_watch +0.15 — weights are named constants, tunable), sum weighted vectors, L2-normalize → upsert `user_taste` with `rated_count`. Pure centroid math lives in `src/lib/taste/vector.ts` and is unit-tested with synthetic vectors. Triggered (via `after()`) on rating insert/update/delete.

### 5.5 Match — `src/lib/taste/match.ts` (pure) + queries

`matchPercent(cosine): number` maps cosine similarity to a 0–100 display value via a calibrated linear ramp (cos 0.2→0, 0.8→100, clamped); a named constant, refined empirically. List/feed queries use pgvector `<=>` (cosine distance) directly.

### 5.6 For-you — `src/services/for-you.ts`

ANN query: titles with embeddings ordered by `embedding <=> taste_vector`, **excluding** titles the user already rated/watchlisted, limit N; returns title + match%. Uses the HNSW index.

## 6. API & UI surfaces

- `GET /api/v1/me/for-you` (authed) → ranked titles + match%. Cold start (`rated_count < 5`): 200 with `{ needsMoreRatings: true }`.
- `GET /api/v1/me/match?titleIds=…` (authed) → `{ [titleId]: matchPercent }` for titles that have embeddings (omits the rest).
- **`/for-you` page** — grid of recommended titles with match badges, or a "rate ~5 titles to unlock" empty state.
- **Detail page** — server-computed match badge in the hero when the user is signed in, has taste, and the title is embedded; otherwise omitted (a title is embedded shortly after first view, so it appears on revisit).
- **`MatchBadge` client island** — opt-in badge on `TitleCard`s that batch-fetches via `me/match`; renders nothing when unavailable. Used on `/for-you` first; reusable elsewhere later.

## 7. Error handling & resilience

Embeddings are **optional and async**: a Voyage outage, a missing key, or an un-embedded title never breaks a page — match simply hides and the feed falls back to TMDB popular. The cron is idempotent and batch-bounded. `me/match` and `for-you` degrade to empty/needs-more states rather than erroring.

## 8. Testing

- **Pure (jsdom/node):** `buildTasteDescriptor`, taste centroid + weighting, `matchPercent`, descriptor hashing.
- **Services (live Neon + pgvector, `__vitest__` isolation, `FakeEmbedder`):** `embedTitle` upsert/idempotency; `recomputeTaste` weighting + normalization; `for-you` ANN ordering and seen-exclusion; cold-start behavior. No network/embedding cost in tests.
- The migration enables `pgvector` so the test DB supports `vector` columns and the HNSW index.

## 9. Environment & config

- New env: `VOYAGE_API_KEY` (embeddings), `CRON_SECRET` (cron auth). Build/test work against `FakeEmbedder`, so production keys aren't blocking until we flip on real embeddings.
- Tunables (rating weights, cold-start threshold = 5, match ramp constants, pool batch size) start as named constants; can graduate to the config system later.

## 10. Decisions log

- **Voyage `voyage-3.5` (1024-d)** for embeddings — Anthropic-aligned, strong retrieval quality; chosen over OpenAI for ecosystem fit. (User decision, 2026-06-14.)
- **Popular pool + per-user similar** candidate strategy — best feed quality without embedding all of TMDB. (User decision, 2026-06-14.)
- **Content-based** taste (embed metadata), not collaborative filtering — works from a single user's data, no cold-start-by-population problem, matches the roadmap's "pgvector embeddings."
- **Separate `title_embeddings` table** (not a column on `titles`) — nullable, model-versioned, re-embeddable without touching the mirror row.

## 11. Out of scope for this slice

Semantic search, concierge, taste import, match on all browse/search cards, taste explanations, A/B-tuned weights, multi-region taste vectors.
