# Axis-grouped "You may also like" design

**Date:** 2026-08-22
**Status:** Approved, ready for implementation planning

## Goal

Turn the flat "More like this" rail on title detail pages into an axis-grouped
section named "You may also like". Each axis answers *why* a title is suggested
with a verifiable shared fact, inspired by the axis-decomposed recommendations
seen on what-next7367.vercel.app, but with no LLM anywhere: every group label is
true by construction because the group is built from the shared fact itself.

## Decisions made during brainstorming

| Decision | Choice | Why |
| --- | --- | --- |
| Sourcing | Discover-built axes | Each group is its own TMDB query keyed on the shared fact; labels are honest by construction, groups are always full, 3-4 cheap cached calls per title |
| Layout | Chip-switched rail | One rail with axis chips above it; compact, page length unchanged, the chip text itself communicates the why |
| Curated recs | Kept as the default "Top picks" chip | Already free in the detail payload; nothing regresses, axes are additive, and it is the safety net for titles with thin credits or generic keywords |

## Findings that shape the design

### Finding 1: keywords are fetched on every title and thrown away

`tmdb.getTitle` appends `keywords` on every detail call (`src/lib/tmdb/client.ts`)
and nothing reads them. Same shape as the liveness spec's `next_episode_to_air`
finding: the axis data is already paid for.

### Finding 2: crew and cast are already parsed

`crewLine` in `src/lib/tmdb/detail.ts` already extracts creators (TV) and
directors (movies) with ids for the facts panel. First-billed cast is already
mapped for the Cast rail. The maker and lead axes need no new parsing, only ids.

### Finding 3: TMDB discover has an asymmetry

`/discover/movie` supports `with_people`, `with_cast`, `with_keywords`,
`with_genres`. `/discover/tv` supports only keywords, genres, networks and
companies; it has no people or cast filters. TV maker and lead axes must come
from `getPerson(id).combined_credits` (an existing client method) filtered to TV
entries instead.

### Finding 4: the Wikidata axes already have homes

Same franchise, spin-offs, remakes, same source and filmed-in already render as
their own rails and pages. This section adds only the TMDB-derived axes and does
not touch those.

## Architecture

### Pure axis selection: `src/lib/tmdb/axes.ts`

```ts
export type TitleAxis =
  | { kind: "person"; personId: number; label: string }   // From creator X / From director X
  | { kind: "cast"; personId: number; label: string }     // Also starring X
  | { kind: "keyword"; keywordId: number; label: string } // More {keyword}
  | { kind: "genre"; genreIds: [number, number]; label: string }; // More {g1} + {g2}

export function axesFor(mediaType: "movie" | "tv", meta: TmdbTitleDetail): TitleAxis[]
```

Reads only the already-fetched detail payload; no fetches, fully unit-testable.
Selection rules:

- **person**: first creator (TV, from `created_by`) or first director (movie,
  from `credits.crew`). Label "From creator {name}" / "From director {name}".
  Skipped when absent.
- **cast**: first-billed cast member. Label "Also starring {name}".
- **keyword**: the first keyword that survives a stoplist of junk or generic
  TMDB keywords ("based on novel or book", "aftercreditsstinger",
  "duringcreditsstinger", "woman director", and similar). Label "More {keyword}".
- **genre**: the title's first two genres. Label "More {genre1} + {genre2}"
  (lowercased genre names). Skipped when the title has fewer than two genres.

At most one axis of each kind; at most 4 axes total.

### Cached group contents: `src/services/title-axes.ts`

```ts
export interface AxisGroup {
  label: string;
  items: TitleResult[];
}

export async function axisGroup(
  mediaType: "movie" | "tv",
  axis: TitleAxis,
  excludeTmdbId: number,
): Promise<AxisGroup>
```

One cached entry per (mediaType, axis identity), `"use cache"`,
`cacheLife("days")`, `cacheTag` per axis (for example `axis:movie:person:1032`).
The tag keys on the axis, not the source title, so every Vince Gilligan show
shares one person-axis entry. The exclude id is applied outside the cached
function so the shared entry stays shareable; the cached function returns the
raw group and the wrapper filters.

Follows the established boundary pattern: the inner cached function throws on a
failed upstream call so failures never fill an entry; the exported wrapper
catches and returns the empty group.

Contents per axis kind:

- Movie person/cast axes: `tmdb.discover("movie", ...)` with `with_people` /
  `with_cast`.
- Movie and TV keyword/genre axes: `tmdb.discover(mediaType, ...)` with
  `with_keywords` / `with_genres`.
- TV person/cast axes: `tmdb.getPerson(personId)` and map
  `combined_credits` filtered to TV; crew entries for the maker axis, cast
  entries for the lead axis, sorted by popularity.
- All discover calls: `sort_by=popularity.desc` plus a `vote_count.gte` floor
  (200 for movies, 100 for TV) to keep junk out.
- Inside the cached function: drop suppressed titles (`isSuppressedTitle`), map
  to `TitleResult` cards, keep up to 13 so the wrapper can drop the source
  title and still return a full group.
- In the wrapper, per caller: drop the source title, cap at 12.

### Components

- **`AlsoLikeSection`** (server, `src/components/catalog/`): receives the
  detail meta and the curated recs already computed by the page. Runs `axesFor`,
  fetches all axis groups in parallel, drops any group with fewer than 3 items,
  and renders `ChipRail`. Suspense-wrapped in the page so it streams.
- **`ChipRail`** (client island): owns only the selected-chip state. Receives
  `{ label, items }[]` with "Top picks" (the curated recs) always first and
  selected by default. Chip switching swaps rail contents instantly with zero
  requests. Renders the same `TitleCard` grid markup as today's rail.

The page replaces the current `recs.length > 0` rail block with
`AlsoLikeSection`; the curated recs computation stays where it is and is passed
down, so "Top picks" costs nothing new.

## Failure behaviour

| Case | Behaviour |
| --- | --- |
| An axis fetch fails | Wrapper returns empty group, chip hidden, nothing cached |
| A group has fewer than 3 items | Chip hidden |
| No axes survive | Section renders exactly like today's rail, retitled "You may also like" |
| No curated recs and no axes | Section renders nothing, matching today |
| Title lacks creator, keywords, or second genre | That axis is skipped in `axesFor` |

## Cost profile

- At most 3-4 extra TMDB calls per title per multi-day cache window, and
  person/genre/keyword entries are shared across titles that produce the same
  axis. TMDB API calls are free; Fluid Compute cost is idle-wait time only.
- CockroachDB: untouched. No new database reads.
- Anonymous and crawler traffic served from cache after first render.
- Serialized payload: 4-5 groups of up to 12 small card objects, a few KB.

## Testing

Unit tests, existing style:

- `axesFor`: stoplist filtering, missing creator, movie director vs TV creator
  paths, fewer than two genres, cast-less title, cap at 4 axes.
- `axisGroup` (mocked client): movie discover path parameters, TV person path
  via combined_credits, source-title exclusion, suppressed-title exclusion,
  12-item cap, error path returns empty without filling the cache (mock throws,
  wrapper returns empty).
- `ChipRail` is exercised through the page as elsewhere; no snapshot tests.

## Out of scope

- Any LLM usage.
- Per-user personalisation (spec 2 territory; this section is catalog fact,
  cacheable for every visitor).
- The Spinoffs & related, Remake / related, Collection, and Filmed-in rails.
- EPG, notifications, or any database-backed signals.
