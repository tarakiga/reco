# "Describe a Scene" Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users find a movie/TV show by describing a scene ("a giant squid attacks a cruise ship") via semantic search over the catalog, returning a ranked shortlist with match %.

**Architecture:** Reuse the existing Voyage + pgvector pipeline. A `searchByScene` service embeds the user's description as a `"query"` vector and runs For-you's nearest-neighbour ANN over `title_embeddings`. A one-time backfill route embeds ~20k popular titles so there's a corpus to search. UI is a shared server-rendered GET form (`SceneSearchBar`) on the home page and a new `/find` page that renders SSR results from `?q=`.

**Tech Stack:** Next.js 16 (App Router, async `searchParams`), Drizzle + Neon pgvector, Voyage `voyage-3.5` embeddings, Vitest (live-DB service tests with the deterministic `FakeEmbedder`), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-14-scene-search-design.md`

**Scope note (deviation from spec, YAGNI):** The spec mentioned a public `GET /api/v1/search/scene` endpoint "primarily for tests and future client use." Because `SceneSearchBar` is a plain GET form and `/find` renders results server-side via the service directly, **nothing consumes that endpoint**, so it is deferred (not built here). The service is tested directly. This keeps the build lean and matches the spec's "future client use" framing.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/services/scene-search.ts` (create) | `searchByScene()` — embed query, ANN over `title_embeddings`, map to ranked `SceneResult[]` |
| `src/services/scene-search.test.ts` (create) | Live-DB test with injected `FakeEmbedder`: ordering, media filter, short-query guard |
| `src/app/api/v1/admin/backfill-catalog/route.ts` (create) | One-time CRON_SECRET-guarded route: mirror + embed a range of TMDB popular pages |
| `src/components/search/SceneSearchBar.tsx` (create) | Shared server-rendered GET form (`action="/find"`) used on home + `/find` |
| `src/app/find/page.tsx` (create) | `/find` page — renders the bar + SSR results from `?q=` |
| `src/app/page.tsx` (modify) | Add the "Describe a scene" CTA card under the Shuffle CTA |

---

## Task 1: `searchByScene` service

**Files:**
- Create: `src/services/scene-search.ts`
- Test: `src/services/scene-search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/scene-search.test.ts`. Mirrors the live-DB pattern in `src/services/user-catalog.test.ts` (Vitest globals are enabled — no `test`/`expect` import needed). It seeds two titles with hand-crafted embeddings: the **target** gets the exact `FakeEmbedder` vector for the query (cosine = 1, so it must rank first), the **other** gets a different vector.

```ts
import { afterAll, beforeAll } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings } from "@/db/schema";
import { FakeEmbedder } from "@/lib/taste/embedder";
import { searchByScene } from "./scene-search";

const QUERY = "a giant squid attacks a cruise ship";
const TARGET_TMDB = 99933001;
const OTHER_TMDB = 99933002;
const fake = new FakeEmbedder();
let targetId: string;
let otherId: string;

beforeAll(async () => {
  await cleanup();
  const [t1] = await db
    .insert(titles)
    .values({ tmdbId: TARGET_TMDB, mediaType: "movie", slug: "squid-ship-1998", title: "Squid Ship", releaseYear: 1998 })
    .returning();
  const [t2] = await db
    .insert(titles)
    .values({ tmdbId: OTHER_TMDB, mediaType: "tv", slug: "garden-show-2001", title: "Garden Show", releaseYear: 2001 })
    .returning();
  targetId = t1.id;
  otherId = t2.id;

  const [qvec] = await fake.embed([QUERY], "query");
  const [other] = await fake.embed(["a calm documentary about flower arranging"], "document");
  await db.insert(titleEmbeddings).values([
    { titleId: targetId, embedding: qvec, model: "fake", descriptorHash: "scene-h1", builtAt: new Date() },
    { titleId: otherId, embedding: other, model: "fake", descriptorHash: "scene-h2", builtAt: new Date() },
  ]);
});
afterAll(cleanup);

async function cleanup() {
  const rows = await db
    .select({ id: titles.id })
    .from(titles)
    .where(inArray(titles.tmdbId, [TARGET_TMDB, OTHER_TMDB]));
  const ids = rows.map((r) => r.id);
  if (ids.length) await db.delete(titleEmbeddings).where(inArray(titleEmbeddings.titleId, ids));
  await db.delete(titles).where(inArray(titles.tmdbId, [TARGET_TMDB, OTHER_TMDB]));
}

test("returns the nearest title first with a 100% match", async () => {
  const res = await searchByScene(QUERY, {}, fake);
  expect(res.length).toBeGreaterThanOrEqual(1);
  expect(res[0].titleId).toBe(targetId);
  expect(res[0].match).toBe(100); // cosine 1 → 100%
  expect(res[0].href).toContain(`/title/movie/${TARGET_TMDB}-`);
});

test("media type filter restricts results", async () => {
  const res = await searchByScene(QUERY, { mediaType: "tv" }, fake);
  expect(res.every((r) => r.mediaType === "tv")).toBe(true);
  expect(res.some((r) => r.titleId === targetId)).toBe(false); // target is a movie
});

test("too-short queries return nothing (no embed call)", async () => {
  expect(await searchByScene("squid", {}, fake)).toEqual([]);
  expect(await searchByScene("two words", {}, fake)).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/services/scene-search.test.ts`
Expected: FAIL — `searchByScene` is not exported / file does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/services/scene-search.ts`. The SQL is a direct adaptation of `forYou()` in `src/services/for-you.ts` (same `1 - (embedding <=> vec)` cosine, same `result.rows ?? result` handling).

```ts
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings } from "@/db/schema";
import { toVectorLiteral } from "@/db/vector";
import { matchPercent } from "@/lib/taste/match";
import { titleSlug } from "@/lib/slug";
import { posterUrl } from "@/lib/tmdb/images";
import { defaultEmbedder, type Embedder } from "@/lib/taste/embedder";

export interface SceneResult {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  match: number;
}

const MIN_WORDS = 3;
const MIN_SIMILARITY = 0.15; // drop near-random matches so nonsense → "nothing matched"
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 40;

/**
 * Semantic "search by scene": embed the description as a query vector and return
 * the nearest titles by cosine similarity. `embedder` is injectable for tests.
 */
export async function searchByScene(
  query: string,
  opts: { limit?: number; mediaType?: "movie" | "tv" } = {},
  embedder: Embedder = defaultEmbedder(),
): Promise<SceneResult[]> {
  const q = query.trim();
  if (q.split(/\s+/).filter(Boolean).length < MIN_WORDS) return [];

  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  let qvec: number[];
  try {
    [qvec] = await embedder.embed([q], "query");
  } catch {
    return []; // embedding provider failure → graceful empty
  }
  const vec = toVectorLiteral(qvec);
  const mediaFilter = opts.mediaType ? sql`AND t.media_type = ${opts.mediaType}` : sql``;

  const result = await db.execute(sql`
    SELECT t.id, t.tmdb_id, t.media_type, t.title, t.release_year, t.poster_path,
           1 - (te.embedding <=> ${vec}::vector) AS cos
    FROM ${titleEmbeddings} te
    JOIN ${titles} t ON t.id = te.title_id
    WHERE 1 = 1 ${mediaFilter}
    ORDER BY te.embedding <=> ${vec}::vector
    LIMIT ${limit}
  `);
  const rows = (result.rows ?? result) as Record<string, unknown>[];

  return rows
    .filter((r) => (r.cos as number) >= MIN_SIMILARITY)
    .map((r) => {
      const title = r.title as string;
      const year = (r.release_year as number | null) ?? null;
      const mediaType = r.media_type as "movie" | "tv";
      const tmdbId = r.tmdb_id as number;
      return {
        titleId: r.id as string,
        tmdbId,
        mediaType,
        title,
        year,
        posterUrl: posterUrl(r.poster_path as string | null),
        href: `/title/${mediaType}/${tmdbId}-${titleSlug(title, year ? `${year}` : null)}`,
        match: matchPercent(r.cos as number),
      };
    });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/services/scene-search.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npx eslint src/services/scene-search.ts src/services/scene-search.test.ts
git add src/services/scene-search.ts src/services/scene-search.test.ts
git commit -m "feat: searchByScene semantic search service"
```

---

## Task 2: Backfill route + run the backfill

**Files:**
- Create: `src/app/api/v1/admin/backfill-catalog/route.ts`

This is an operational route (like the existing `cron/embed-popular` route, which has no unit test). It is verified by running it and checking the embedded-title count climbs toward ~20k.

- [ ] **Step 1: Write the route**

Mirrors `src/app/api/cron/embed-popular/route.ts` (same CRON_SECRET auth, same `getOrCreateTitle` + `embedTitles` + `defaultEmbedder`). Processes a page range so it can be driven in chunks.

```ts
import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { getOrCreateTitle } from "@/services/catalog";
import { embedTitles } from "@/services/title-embeddings";
import { defaultEmbedder } from "@/lib/taste/embedder";

export const maxDuration = 300;

/** One-time catalog backfill: mirror + embed a range of TMDB popular pages.
 *  Idempotent (getOrCreateTitle + embedTitles both skip existing/unchanged). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "tv" ? "tv" : "movie";
  const from = Math.max(1, Number(url.searchParams.get("from") ?? 1));
  const to = Math.min(500, Number(url.searchParams.get("to") ?? from));

  const ids: string[] = [];
  for (let page = from; page <= to; page++) {
    try {
      const { results } = await tmdb.popular(type, page);
      for (const r of results) {
        try {
          const row = await getOrCreateTitle(type, r.id);
          ids.push(row.id);
        } catch {
          /* skip a single title that won't mirror */
        }
      }
    } catch {
      /* skip a failed page */
    }
  }
  const embedded = await embedTitles(ids, defaultEmbedder());
  return NextResponse.json({ type, from, to, mirrored: ids.length, embedded });
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit
npx eslint src/app/api/v1/admin/backfill-catalog/route.ts
```

- [ ] **Step 3: Run the backfill against the local dev server**

The dev server has no `maxDuration` cap, so each call can process many pages. Read `CRON_SECRET` from `.env` into a shell variable (never echo it). Process movies then TV in chunks of 25 pages (500 titles/chunk). Run in the background and monitor.

```bash
# dev server must be running (npm run dev). CRON_SECRET stays in the variable, never printed.
SECRET=$(grep -E '^CRON_SECRET=' .env | cut -d= -f2-)
for type in movie tv; do
  for start in $(seq 1 25 500); do
    end=$((start+24))
    curl -s -H "authorization: Bearer $SECRET" \
      "http://localhost:3000/api/v1/admin/backfill-catalog?type=$type&from=$start&to=$end" \
      | grep -oE '"mirrored":[0-9]+|"embedded":[0-9]+'
  done
done
```

- [ ] **Step 4: Verify the corpus grew**

```bash
node -e "import('dotenv/config').then(async()=>{const {neon}=await import('@neondatabase/serverless');const sql=neon(process.env.DATABASE_URL);const a=await sql\`select count(*)::int n from title_embeddings\`;console.log('embedded titles:',a[0].n);})"
```
Expected: a count in the thousands (target ~20k once both runs complete; partial is fine — the route is re-runnable to fill gaps).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/admin/backfill-catalog/route.ts
git commit -m "feat: catalog backfill route for semantic search corpus"
```

---

## Task 3: `SceneSearchBar` component

**Files:**
- Create: `src/components/search/SceneSearchBar.tsx`

A server-rendered GET form (no client JS), mirroring the `<form action="/search" method="get">` in `src/app/search/page.tsx`. Submitting navigates to `/find?q=<input>`.

- [ ] **Step 1: Write the component**

```tsx
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/** Shared "describe a scene" search box. A plain GET form → /find?q=...
 *  Used on the home CTA and the /find page (pre-filled via initialQuery). */
export function SceneSearchBar({ initialQuery }: { initialQuery?: string }) {
  return (
    <form action="/find" method="get" className="flex items-end gap-3">
      <div className="flex-1">
        <Input
          name="q"
          label="Describe a scene you remember"
          placeholder="e.g. a giant squid attacks a cruise ship"
          defaultValue={initialQuery}
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit
npx eslint src/components/search/SceneSearchBar.tsx
```
Expected: clean. (No unit test — presentational; verified in the browser via Tasks 4–5.)

- [ ] **Step 3: Commit**

```bash
git add src/components/search/SceneSearchBar.tsx
git commit -m "feat: SceneSearchBar shared search form"
```

---

## Task 4: `/find` page

**Files:**
- Create: `src/app/find/page.tsx`

Mirrors `src/app/search/page.tsx` (async `searchParams`, `generateMetadata`, `Suspense` results). Renders the bar + SSR results from `searchByScene`.

- [ ] **Step 1: Write the page**

```tsx
import { Suspense } from "react";
import { searchByScene } from "@/services/scene-search";
import { SceneSearchBar } from "@/components/search/SceneSearchBar";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MatchBadge } from "@/components/catalog/MatchBadge";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();
  return { title: query ? `Find: ${query}` : "Find a movie" };
}

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-text">Find a movie by memory</h1>
      <p className="mb-6 max-w-xl text-text-muted">
        Can&apos;t remember the name? Describe a scene or the plot and we&apos;ll find the closest matches.
      </p>
      <SceneSearchBar initialQuery={query} />
      {query ? (
        <Suspense key={query} fallback={<div className="mt-8"><PosterGridSkeleton /></div>}>
          <SceneResults query={query} />
        </Suspense>
      ) : (
        <p className="mt-8 text-center text-text-muted">
          Try something like &ldquo;a giant squid attacks a cruise ship&rdquo;.
        </p>
      )}
    </div>
  );
}

async function SceneResults({ query }: { query: string }) {
  const results = await searchByScene(query, { limit: 24 });

  if (results.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title="Nothing matched"
          description="Try describing it differently — more detail about the scene or plot usually helps."
        />
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {results.map((r) => (
        <div key={r.titleId} className="relative">
          <div className="absolute left-1.5 top-1.5 z-10">
            <MatchBadge match={r.match} />
          </div>
          <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit
npx eslint src/app/find/page.tsx
```

- [ ] **Step 3: Verify in the browser**

With the dev server running and the backfill (Task 2) done, navigate to `http://localhost:3000/find?q=a%20giant%20squid%20attacks%20a%20cruise%20ship`. Expect: the search bar pre-filled, and a grid of poster cards with match badges (a sea-creature/ship movie like *Deep Rising* should appear near the top). Also check `http://localhost:3000/find` (no query) shows the prompt, and a nonsense query shows "Nothing matched".

- [ ] **Step 4: Commit**

```bash
git add src/app/find/page.tsx
git commit -m "feat: /find page with semantic scene search results"
```

---

## Task 5: Home page CTA

**Files:**
- Modify: `src/app/page.tsx`

Add a "Describe a scene" CTA card directly **under** the existing Shuffle CTA `<section>` (the one with the "Can't decide?" eyebrow). It contains the shared `SceneSearchBar`.

- [ ] **Step 1: Add the import**

At the top of `src/app/page.tsx`, alongside the other component imports (e.g. after the `ForYouPreview` import), add:

```tsx
import { SceneSearchBar } from "@/components/search/SceneSearchBar";
```

- [ ] **Step 2: Insert the CTA section**

Immediately **after** the closing `</section>` of the Shuffle CTA (the block whose comment reads `{/* Shuffle call-to-action — prominent so impatient visitors can't miss it. */}`) and **before** `<ForYouPreview />`, insert:

```tsx
      {/* "Describe a scene" CTA — find a film by what you remember. */}
      <section className="mb-10">
        <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Can&apos;t remember the name?
          </p>
          <h2 className="mt-1 text-2xl font-bold text-text sm:text-3xl">Describe what you remember</h2>
          <p className="mb-4 mt-2 max-w-xl text-text-muted">
            Recall a scene but not the title? Describe it and we&apos;ll find the closest matches.
          </p>
          <SceneSearchBar />
        </div>
      </section>
```

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit
npx eslint src/app/page.tsx
```

- [ ] **Step 4: Verify in the browser**

Navigate to `http://localhost:3000/`. Expect the new CTA card under the Shuffle one, with the description box. Type "a giant squid attacks a cruise ship", click Search → lands on `/find?q=...` showing ranked results with the same bar at the top.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: home CTA — describe a scene to find a movie"
```

---

## Final verification (after all tasks)

- [ ] Full suite: `npx vitest run --exclude "**/*.stories.tsx"` → all pass (Task 1 adds 3 tests).
- [ ] `npx tsc --noEmit` and `npx eslint src` clean.
- [ ] Browser smoke: home CTA → `/find` results; `/find` bar re-search; shareable `/find?q=` URL renders results; nonsense query → "Nothing matched".
- [ ] Then finish via `superpowers:finishing-a-development-branch` (merge `scene-search` → main, push/deploy).
