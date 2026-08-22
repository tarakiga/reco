# Axis-grouped "You may also like" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat "More like this" rail on title detail pages with a chip-switched "You may also like" section whose extra chips are axis groups built from verifiable shared facts (same maker, same lead, shared keyword, shared genre pair), with no LLM anywhere.

**Architecture:** A pure `axesFor` helper reads the already-fetched title detail payload and emits up to 4 axis descriptors. A cached service turns each axis into a title group via TMDB discover (or, for TV person axes, the person's combined credits, because `/discover/tv` has no people filters), cached per axis so titles sharing an axis share one entry. A server component assembles "Top picks" (today's curated recs, unchanged) plus surviving axis groups and hands them to a small client chip-rail island.

**Tech Stack:** Next.js 16 App Router with `cacheComponents` (`"use cache"`, `cacheLife`, `cacheTag`), TMDB API, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-22-also-like-axes-design.md`

**Project rules that bind every task:**
- Never use em dashes in any user-facing string or code comment.
- Commit with targeted `git add <paths>` only. Never `git add -A` or `git add .`; the untracked `producthunt-launch-copy.md` at repo root must never be committed.
- No Co-Authored-By trailer on commits.
- Do not run `git push`; the user pushes.
- The full test suite has one pre-existing failure (`PageShell.stories` Clerk issue). It is not yours; leave it.

**Codebase facts the tasks rely on** (verified 2026-08-22):
- `TmdbTitleDetail` (`src/lib/tmdb/types.ts`) carries `genres`, `created_by` (TV), `credits.cast/crew`, and `keywords` in the shape `{ keywords?: {...}[] }` for movies but `{ results?: {...}[] }` for TV. Keywords are fetched on every `getTitle` and currently unused.
- The page reads `meta` from DB-stored metadata slimmed by `slimTitleMetadata` (`src/lib/tmdb/slim.ts`), which spreads the raw payload, so `keywords`/`created_by`/`genres` survive. Titles stored before `keywords` joined `append_to_response` may lack keywords; `axesFor` must simply skip that axis.
- `toBrowseResults(mediaType, items)` in `src/lib/tmdb/discover.ts` maps `TmdbSearchItem[]` to `TitleResult[]` and already filters suppressed titles. Reuse it; do not re-map by hand.
- `tmdb.discover(mediaType, params)` and `tmdb.getPerson(id)` exist in `src/lib/tmdb/client.ts`. TMDB `/discover/movie` supports `with_people`/`with_cast`/`with_keywords`/`with_genres`; `/discover/tv` supports only keywords/genres.
- Cached-service boundary pattern (see `src/services/title-extras.ts`): the inner `"use cache"` function throws on upstream failure so errors never fill an entry; the exported wrapper catches and returns the empty shape. Vitest aliases `next/cache` to a stub, so cached services are directly testable.
- `Rail` (`src/components/catalog/Rail.tsx`) is a client component with `title`, optional `action`, `children`.
- The page block to replace lives at `src/app/title/[mediaType]/[idSlug]/page.tsx:345-353` (the `recs.length > 0` rail).

---

### Task 1: Pure axis selection (`axesFor`)

**Files:**
- Create: `src/lib/tmdb/axes.ts`
- Test: `src/lib/tmdb/axes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tmdb/axes.test.ts`:

```ts
import { test, expect } from "vitest";
import { axesFor, axisKey, type TitleAxis } from "./axes";
import type { TmdbTitleDetail } from "./types";

const movieMeta = {
  id: 680,
  credits: {
    cast: [
      { id: 8891, name: "John Travolta", order: 0 },
      { id: 2231, name: "Samuel L. Jackson", order: 1 },
    ],
    crew: [
      { id: 138, name: "Quentin Tarantino", job: "Director" },
      { id: 139, name: "Roger Avary", job: "Writer" },
    ],
  },
  keywords: {
    keywords: [
      { id: 1, name: "aftercreditsstinger" },
      { id: 622, name: "hitman" },
      { id: 623, name: "nonlinear timeline" },
    ],
  },
  genres: [
    { id: 53, name: "Thriller" },
    { id: 80, name: "Crime" },
  ],
} as TmdbTitleDetail;

test("movie: director, lead, first non-stoplisted keyword, genre pair", () => {
  const axes = axesFor("movie", movieMeta);
  expect(axes).toEqual([
    { kind: "person", personId: 138, label: "From director Quentin Tarantino" },
    { kind: "cast", personId: 8891, label: "Also starring John Travolta" },
    { kind: "keyword", keywordId: 622, label: "More hitman" },
    { kind: "genre", genreIds: [53, 80], label: "More thriller + crime" },
  ]);
});

test("tv: person axis comes from created_by and keywords from results", () => {
  const meta = {
    id: 1396,
    created_by: [{ id: 66633, name: "Vince Gilligan" }],
    credits: { cast: [{ id: 17419, name: "Bryan Cranston", order: 0 }] },
    keywords: { results: [{ id: 15009, name: "drug cartel" }] },
    genres: [
      { id: 18, name: "Drama" },
      { id: 80, name: "Crime" },
    ],
  } as TmdbTitleDetail;
  const axes = axesFor("tv", meta);
  expect(axes).toEqual([
    { kind: "person", personId: 66633, label: "From creator Vince Gilligan" },
    { kind: "cast", personId: 17419, label: "Also starring Bryan Cranston" },
    { kind: "keyword", keywordId: 15009, label: "More drug cartel" },
    { kind: "genre", genreIds: [18, 80], label: "More drama + crime" },
  ]);
});

test("lead is the lowest billing order, not array position", () => {
  const meta = {
    id: 1,
    credits: {
      cast: [
        { id: 2, name: "Second", order: 1 },
        { id: 1, name: "First", order: 0 },
      ],
    },
  } as TmdbTitleDetail;
  const axes = axesFor("movie", meta);
  expect(axes).toEqual([{ kind: "cast", personId: 1, label: "Also starring First" }]);
});

test("stoplisted and empty keywords never produce an axis", () => {
  const meta = {
    id: 1,
    keywords: { keywords: [{ id: 1, name: "aftercreditsstinger" }, { id: 2, name: "woman director" }] },
  } as TmdbTitleDetail;
  expect(axesFor("movie", meta)).toEqual([]);
});

test("fewer than two genres skips the genre axis", () => {
  const meta = { id: 1, genres: [{ id: 18, name: "Drama" }] } as TmdbTitleDetail;
  expect(axesFor("tv", meta)).toEqual([]);
});

test("empty meta yields no axes", () => {
  expect(axesFor("movie", { id: 1 } as TmdbTitleDetail)).toEqual([]);
});

test("axisKey is stable per axis identity and mediaType", () => {
  const person: TitleAxis = { kind: "person", personId: 138, label: "From director Quentin Tarantino" };
  const genre: TitleAxis = { kind: "genre", genreIds: [53, 80], label: "More thriller + crime" };
  expect(axisKey("movie", person)).toBe("axis:movie:person:138");
  expect(axisKey("tv", { kind: "cast", personId: 17419, label: "x" })).toBe("axis:tv:cast:17419");
  expect(axisKey("movie", { kind: "keyword", keywordId: 622, label: "x" })).toBe("axis:movie:keyword:622");
  expect(axisKey("movie", genre)).toBe("axis:movie:genre:53-80");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/tmdb/axes.test.ts`
Expected: FAIL with a module-resolution error for `./axes`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/tmdb/axes.ts`:

```ts
import type { TmdbTitleDetail } from "./types";

/** One reason-to-recommend, derived from a fact the source title shares with
 *  every member of its group, so the label is true by construction. */
export type TitleAxis =
  | { kind: "person"; personId: number; label: string }
  | { kind: "cast"; personId: number; label: string }
  | { kind: "keyword"; keywordId: number; label: string }
  | { kind: "genre"; genreIds: [number, number]; label: string };

/** TMDB keywords too structural or generic to make a meaningful group. */
const KEYWORD_STOPLIST = new Set([
  "aftercreditsstinger",
  "duringcreditsstinger",
  "based on novel or book",
  "based on comic",
  "based on true story",
  "based on a true story",
  "woman director",
  "sequel",
  "remake",
  "short film",
  "anthology",
]);

/** Up to 4 axes (one per kind) read from the already-fetched detail payload.
 *  Pure; anything missing (no crew, no keywords, one genre) just skips its axis. */
export function axesFor(mediaType: "movie" | "tv", meta: TmdbTitleDetail): TitleAxis[] {
  const out: TitleAxis[] = [];

  const maker =
    mediaType === "tv"
      ? meta.created_by?.[0]
      : meta.credits?.crew?.find((c) => c.job === "Director");
  if (maker) {
    out.push({
      kind: "person",
      personId: maker.id,
      label: mediaType === "tv" ? `From creator ${maker.name}` : `From director ${maker.name}`,
    });
  }

  const lead = [...(meta.credits?.cast ?? [])].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999),
  )[0];
  if (lead) out.push({ kind: "cast", personId: lead.id, label: `Also starring ${lead.name}` });

  // TMDB quirk: movies nest keywords under .keywords, TV under .results.
  const keywords = mediaType === "tv" ? meta.keywords?.results : meta.keywords?.keywords;
  const keyword = (keywords ?? []).find(
    (k) => k.name && !KEYWORD_STOPLIST.has(k.name.toLowerCase()),
  );
  if (keyword) {
    out.push({ kind: "keyword", keywordId: keyword.id, label: `More ${keyword.name.toLowerCase()}` });
  }

  const genres = meta.genres ?? [];
  if (genres.length >= 2) {
    out.push({
      kind: "genre",
      genreIds: [genres[0].id, genres[1].id],
      label: `More ${genres[0].name.toLowerCase()} + ${genres[1].name.toLowerCase()}`,
    });
  }

  return out;
}

/** Stable identity for cache tags. Keys on the axis, not the source title, so
 *  every title sharing an axis shares one cached group. */
export function axisKey(mediaType: "movie" | "tv", axis: TitleAxis): string {
  switch (axis.kind) {
    case "person":
    case "cast":
      return `axis:${mediaType}:${axis.kind}:${axis.personId}`;
    case "keyword":
      return `axis:${mediaType}:keyword:${axis.keywordId}`;
    case "genre":
      return `axis:${mediaType}:genre:${axis.genreIds[0]}-${axis.genreIds[1]}`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/tmdb/axes.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tmdb/axes.ts src/lib/tmdb/axes.test.ts
git commit -m "Pick recommendation axes from data already on the title"
```

---

### Task 2: Cached axis groups service

**Files:**
- Create: `src/services/title-axes.ts`
- Test: `src/services/title-axes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/services/title-axes.test.ts`:

```ts
import { vi, test, expect, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/tmdb/client", () => ({ tmdb: { discover: vi.fn(), getPerson: vi.fn() } }));
// Deterministic suppression so the test does not depend on the real list.
vi.mock("@/lib/tmdb/suppressed", () => ({
  isSuppressedTitle: (_mt: "movie" | "tv", id: number) => id === 666,
}));

import { tmdb } from "@/lib/tmdb/client";
import { axisGroup } from "./title-axes";
import type { TitleAxis } from "@/lib/tmdb/axes";

const item = (id: number, title: string, popularity = 0) => ({
  id,
  title,
  poster_path: null,
  release_date: "2020-01-01",
  popularity,
});

beforeEach(() => {
  vi.clearAllMocks();
});

test("movie person axis queries discover with with_people and a vote floor", async () => {
  (tmdb.discover as Mock).mockResolvedValue({ results: [item(1, "A"), item(2, "B")] });
  const axis: TitleAxis = { kind: "person", personId: 138, label: "From director Quentin Tarantino" };
  const out = await axisGroup("movie", axis, 999);
  expect(tmdb.discover).toHaveBeenCalledWith("movie", {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": "200",
    with_people: "138",
  });
  expect(out.label).toBe("From director Quentin Tarantino");
  expect(out.items.map((i) => i.tmdbId)).toEqual([1, 2]);
});

test("keyword and genre axes pass their discover filters", async () => {
  (tmdb.discover as Mock).mockResolvedValue({ results: [] });
  await axisGroup("tv", { kind: "keyword", keywordId: 622, label: "More hitman" }, 1);
  expect(tmdb.discover).toHaveBeenLastCalledWith("tv", {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": "100",
    with_keywords: "622",
  });
  await axisGroup("movie", { kind: "genre", genreIds: [53, 80], label: "More thriller + crime" }, 1);
  expect(tmdb.discover).toHaveBeenLastCalledWith("movie", {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": "200",
    with_genres: "53,80",
  });
});

test("the source title is excluded and the group caps at 12", async () => {
  const results = Array.from({ length: 15 }, (_, i) => item(i + 1, `T${i + 1}`));
  (tmdb.discover as Mock).mockResolvedValue({ results });
  const out = await axisGroup("movie", { kind: "keyword", keywordId: 1, label: "More x" }, 3);
  expect(out.items).toHaveLength(12);
  expect(out.items.some((i) => i.tmdbId === 3)).toBe(false);
});

test("tv cast axis uses the person's combined credits, tv only, by popularity", async () => {
  (tmdb.getPerson as Mock).mockResolvedValue({
    id: 17419,
    name: "Bryan Cranston",
    combined_credits: {
      cast: [
        { ...item(1396, ""), name: "Breaking Bad", media_type: "tv", first_air_date: "2008-01-20", popularity: 300 },
        { ...item(2316, ""), name: "The Office", media_type: "tv", first_air_date: "2005-03-24", popularity: 500 },
        { ...item(680, "Pulp Fiction"), media_type: "movie", popularity: 900 },
      ],
    },
  });
  const axis: TitleAxis = { kind: "cast", personId: 17419, label: "Also starring Bryan Cranston" };
  const out = await axisGroup("tv", axis, 1);
  expect(tmdb.discover).not.toHaveBeenCalled();
  expect(out.items.map((i) => i.tmdbId)).toEqual([2316, 1396]);
});

test("tv maker axis prefers Creator crew credits and dedupes repeat shows", async () => {
  (tmdb.getPerson as Mock).mockResolvedValue({
    id: 66633,
    name: "Vince Gilligan",
    combined_credits: {
      crew: [
        { ...item(1396, ""), name: "Breaking Bad", media_type: "tv", job: "Creator", popularity: 300 },
        { ...item(1396, ""), name: "Breaking Bad", media_type: "tv", job: "Executive Producer", popularity: 300 },
        { ...item(60059, ""), name: "Better Call Saul", media_type: "tv", job: "Creator", popularity: 200 },
        { ...item(999, ""), name: "Some EP Gig", media_type: "tv", job: "Executive Producer", popularity: 900 },
      ],
    },
  });
  const axis: TitleAxis = { kind: "person", personId: 66633, label: "From creator Vince Gilligan" };
  const out = await axisGroup("tv", axis, 1);
  expect(out.items.map((i) => i.tmdbId)).toEqual([1396, 60059]);
});

test("suppressed titles never enter a group", async () => {
  (tmdb.discover as Mock).mockResolvedValue({ results: [item(1, "A"), item(666, "Nope"), item(2, "B")] });
  const out = await axisGroup("movie", { kind: "keyword", keywordId: 1, label: "More x" }, 99);
  expect(out.items.map((i) => i.tmdbId)).toEqual([1, 2]);
});

test("an upstream failure degrades to an empty group", async () => {
  (tmdb.discover as Mock).mockRejectedValue(new Error("tmdb down"));
  const out = await axisGroup("movie", { kind: "keyword", keywordId: 1, label: "More x" }, 1);
  expect(out).toEqual({ label: "More x", items: [] });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/title-axes.test.ts`
Expected: FAIL with a module-resolution error for `./title-axes`.

- [ ] **Step 3: Write the implementation**

Create `src/services/title-axes.ts`:

```ts
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toBrowseResults } from "@/lib/tmdb/discover";
import type { TitleResult } from "@/lib/tmdb/transform";
import type { TmdbSearchItem } from "@/lib/tmdb/types";
import { axisKey, type TitleAxis } from "@/lib/tmdb/axes";

export interface AxisGroup {
  label: string;
  items: TitleResult[];
}

const GROUP_SIZE = 12;
// One spare so dropping the source title still leaves a full rail.
const FETCH_SIZE = GROUP_SIZE + 1;

function discoverParams(mediaType: "movie" | "tv", axis: TitleAxis): Record<string, string> {
  const params: Record<string, string> = {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": mediaType === "movie" ? "200" : "100",
  };
  if (axis.kind === "person") params.with_people = String(axis.personId);
  if (axis.kind === "cast") params.with_cast = String(axis.personId);
  if (axis.kind === "keyword") params.with_keywords = String(axis.keywordId);
  if (axis.kind === "genre") params.with_genres = `${axis.genreIds[0]},${axis.genreIds[1]}`;
  return params;
}

/** discover/tv has no people or cast filters, so TV person axes come from the
 *  person's combined credits instead: cast entries for the lead axis, crew for
 *  the maker axis (Creator credits when present, any TV crew credit otherwise). */
async function tvPersonItems(
  axis: Extract<TitleAxis, { kind: "person" | "cast" }>,
): Promise<TmdbSearchItem[]> {
  const person = await tmdb.getPerson(axis.personId);
  const pool: (TmdbSearchItem & { job?: string })[] =
    axis.kind === "cast"
      ? (person.combined_credits?.cast ?? [])
      : (person.combined_credits?.crew ?? []);
  let tv = pool.filter((c) => c.media_type === "tv" && !c.adult);
  if (axis.kind === "person") {
    const created = tv.filter((c) => c.job === "Creator");
    if (created.length) tv = created;
  }
  const seen = new Set<number>();
  const unique = tv.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  return unique.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

/** Cached per axis, not per source title, so every title sharing the axis
 *  shares one entry. Upstream failures throw out of here on purpose; a thrown
 *  error never fills the entry, so a TMDB blip is retried instead of pinning
 *  an empty group for days. The catch lives in the exported wrapper. */
async function groupCached(mediaType: "movie" | "tv", axis: TitleAxis): Promise<TitleResult[]> {
  "use cache";
  cacheLife("days");
  cacheTag(axisKey(mediaType, axis));

  const items =
    mediaType === "tv" && (axis.kind === "person" || axis.kind === "cast")
      ? await tvPersonItems(axis)
      : (await tmdb.discover(mediaType, discoverParams(mediaType, axis))).results;

  return toBrowseResults(mediaType, items).slice(0, FETCH_SIZE);
}

/** Titles for one axis, minus the source title. Never throws; empty items on failure. */
export async function axisGroup(
  mediaType: "movie" | "tv",
  axis: TitleAxis,
  excludeTmdbId: number,
): Promise<AxisGroup> {
  try {
    const items = await groupCached(mediaType, axis);
    return {
      label: axis.label,
      items: items.filter((i) => i.tmdbId !== excludeTmdbId).slice(0, GROUP_SIZE),
    };
  } catch {
    return { label: axis.label, items: [] };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/title-axes.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/title-axes.ts src/services/title-axes.test.ts
git commit -m "Build cached title groups for each recommendation axis"
```

---

### Task 3: `Rail` subheader slot and the `ChipRail` client island

**Files:**
- Modify: `src/components/catalog/Rail.tsx`
- Create: `src/components/catalog/ChipRail.tsx`

- [ ] **Step 1: Add an optional subheader slot to Rail**

In `src/components/catalog/Rail.tsx`, change the signature:

```tsx
export function Rail({
  title,
  action,
  subheader,
  children,
}: {
  title: string;
  action?: ReactNode;
  /** Optional row between the heading and the cards (e.g. filter chips). */
  subheader?: ReactNode;
  children: ReactNode;
}) {
```

and render it between the heading row and the card scroller. The heading block becomes:

```tsx
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {action}
      </div>

      {subheader}

      <div className="group relative">
```

No other changes to Rail.

- [ ] **Step 2: Create ChipRail**

Create `src/components/catalog/ChipRail.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Rail } from "./Rail";
import { TitleCard } from "./TitleCard";
import type { TitleResult } from "@/lib/tmdb/transform";

export interface ChipGroup {
  label: string;
  items: TitleResult[];
}

/** Chip-switched title rail. Every group arrives server-fetched, so switching
 *  chips swaps the cards instantly with zero requests. A single group renders
 *  as a plain rail with no chip row. */
export function ChipRail({ title, groups }: { title: string; groups: ChipGroup[] }) {
  const [selected, setSelected] = useState(0);
  const active = groups[selected] ?? groups[0];
  if (!active) return null;

  const chips =
    groups.length > 1 ? (
      <div className="mb-3 flex flex-wrap gap-2">
        {groups.map((g, i) => (
          <button
            key={g.label}
            type="button"
            onClick={() => setSelected(i)}
            aria-pressed={i === selected}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              i === selected
                ? "border-accent bg-accent/15 text-accent-text"
                : "border-border bg-surface-raised text-text-muted hover:bg-surface-overlay hover:text-text"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    // Keyed by group so switching chips resets the scroll position.
    <Rail key={active.label} title={title} subheader={chips}>
      {active.items.map((r) => (
        <div key={`${r.mediaType}-${r.tmdbId}`} className="w-28 shrink-0">
          <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} />
        </div>
      ))}
    </Rail>
  );
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no new errors.
Run: `npx eslint src/components/catalog/Rail.tsx src/components/catalog/ChipRail.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/catalog/Rail.tsx src/components/catalog/ChipRail.tsx
git commit -m "Add a chip-switched rail component"
```

---

### Task 4: `AlsoLikeSection` and page wiring

**Files:**
- Create: `src/components/catalog/AlsoLikeSection.tsx`
- Modify: `src/app/title/[mediaType]/[idSlug]/page.tsx:345-353` (plus its imports)

- [ ] **Step 1: Create the server component**

Create `src/components/catalog/AlsoLikeSection.tsx`:

```tsx
import { axesFor } from "@/lib/tmdb/axes";
import { axisGroup } from "@/services/title-axes";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import type { TitleResult } from "@/lib/tmdb/transform";
import { ChipRail, type ChipGroup } from "./ChipRail";

// A rail with fewer than 3 posters looks broken; hide the chip instead.
const MIN_GROUP = 3;

/** "You may also like": the curated TMDB recommendations as the default
 *  Top picks chip, plus axis chips whose membership is a verifiable shared
 *  fact (same maker, same lead, shared keyword, shared genre pair). */
export async function AlsoLikeSection({
  mediaType,
  tmdbId,
  meta,
  recs,
}: {
  mediaType: "movie" | "tv";
  tmdbId: number;
  meta: TmdbTitleDetail;
  recs: TitleResult[];
}) {
  const axes = axesFor(mediaType, meta);
  const groups = await Promise.all(axes.map((a) => axisGroup(mediaType, a, tmdbId)));

  const chips: ChipGroup[] = [
    ...(recs.length > 0 ? [{ label: "Top picks", items: recs }] : []),
    ...groups.filter((g) => g.items.length >= MIN_GROUP),
  ];
  if (chips.length === 0) return null;

  return <ChipRail title="You may also like" groups={chips} />;
}
```

- [ ] **Step 2: Wire it into the title page**

In `src/app/title/[mediaType]/[idSlug]/page.tsx`, replace the recs rail block (currently lines 345-353):

```tsx
          {recs.length > 0 && (
            <Rail title="More like this">
              {recs.map((r) => (
                <div key={`${r.mediaType}-${r.tmdbId}`} className="w-28 shrink-0">
                  <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} />
                </div>
              ))}
            </Rail>
          )}
```

with:

```tsx
          <Suspense fallback={null}>
            <AlsoLikeSection mediaType={mediaType} tmdbId={id} meta={meta} recs={recs} />
          </Suspense>
```

Then fix the imports at the top of the file:
- Add: `import { AlsoLikeSection } from "@/components/catalog/AlsoLikeSection";`
- Remove the `TitleCard` import ONLY if it is now unused in this file. Verify first with: `grep -n "TitleCard" "src/app/title/[mediaType]/[idSlug]/page.tsx"` and keep it if any other usage remains. Same check for `Rail` (it is still used by the Cast rail at line 314, so it stays).

The `recs` computation (`const recs = recommendations(meta);` at line 127) stays where it is; it feeds the Top picks chip.

- [ ] **Step 3: Verify types, lint, and the full suite**

Run: `npx tsc --noEmit`
Expected: no new errors.
Run: `npx eslint "src/app/title/[mediaType]/[idSlug]/page.tsx" src/components/catalog/AlsoLikeSection.tsx`
Expected: clean.
Run: `npx vitest run`
Expected: everything passes except the 1 pre-existing `PageShell.stories` Clerk failure.

- [ ] **Step 4: Smoke-check the page renders**

Run: `npm run build`
Expected: build succeeds. (`AlsoLikeSection` streams inside Suspense; the cached axis groups are request-time work behind `"use cache"`, which is compatible with `cacheComponents` prerendering.)

- [ ] **Step 5: Commit**

```bash
git add src/components/catalog/AlsoLikeSection.tsx "src/app/title/[mediaType]/[idSlug]/page.tsx"
git commit -m "Group You may also like by shared-fact axes"
```

---

## Verification checklist (after all tasks)

- [ ] A movie page (e.g. `/title/movie/680-pulp-fiction-1994`) shows "You may also like" opening on Top picks, with chips like "From director Quentin Tarantino", "Also starring John Travolta", a keyword chip, and a genre chip. Switching chips swaps posters instantly.
- [ ] A TV page (e.g. Breaking Bad) shows "From creator Vince Gilligan" backed by combined credits, not discover.
- [ ] A title with no keywords in stored metadata (stored before keywords were appended) still renders; the keyword chip is simply absent.
- [ ] No new CockroachDB queries: the section touches only TMDB plus the Next.js cache.
