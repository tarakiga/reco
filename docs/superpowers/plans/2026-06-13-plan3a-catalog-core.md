# Plan 3a: Catalog Core (Read Surfaces) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The public, read-only catalog: a TMDB client + lazy mirror (titles/people in Postgres), movie/TV detail pages with cast + trailer + where-to-watch, person pages with filmography, multi-search (titles + people), and a trending home page — all composed from the existing component library with TMDB/JustWatch attribution.

**Architecture:** TMDB (v3 `api_key` auth) is the catalog source of truth, mirrored **lazily** into Neon Postgres on first view (titles/people tables with `tmdb_id`, slug, denormalized display fields, `metadata` JSONB, `refreshed_at`). Detail pages are Server Components that call a mirror service (`getOrCreateTitle`/`getOrCreatePerson`) which serves the local row and refreshes from TMDB when stale. Search and trending proxy TMDB directly (no mirror needed until a detail view). Routes embed the TMDB id in the slug (`/title/movie/603-the-matrix`) so lazy resolution needs no pre-existing DB row. Streaming availability comes from TMDB's JustWatch-backed watch-providers data, region-aware.

**Tech Stack:** Next.js 16 (App Router, cacheComponents/PPR), Drizzle + Neon, Zod, existing Tailwind v4 tokens + component library, TMDB API v3.

**Spec:** `docs/superpowers/specs/2026-06-12-reco-v1-design.md` sections 3 (data architecture), 6 (pages — home/title/person/search), component library.
**Plan 3b (watchlists, ratings, browse filters) is a separate plan, written after 3a completes.**

**Verified preconditions:** `TMDB_API_KEY` in `.env`/`.env.local` is a 32-char **v3** key; auth via `?api_key=<key>` query param works (`/search/multi?query=matrix&api_key=…` → 200, 20 results). TMDB image base: `https://image.tmdb.org/t/p/<size><path>`.

**Conventions:** repo root `D:\work\Tar\PROJECTS\reco`, branch `plan-3a-catalog-core` (create from master at start). Commit after every task. TDD for client/services/transforms (mock fetch for the client; live-db `__vitest__`-isolated tests for the mirror, cleaned up). Components get Storybook stories; pages get a Playwright smoke at close-out. Server-only services; Client islands (none needed in 3a — all pages are server-rendered reads) talk via services directly in RSC. Never print env values. Never touch `D:\wamp64\www\rizmos`.

**Route shape decision (deviation from spec's pure-slug route, with rationale):** detail routes embed the TMDB id: `/title/[mediaType]/[idSlug]` (e.g. `/title/movie/603-the-matrix`) and `/person/[idSlug]` (e.g. `/person/6384-keanu-reeves`). The leading integer is parsed as the TMDB id (the reliable lazy-mirror lookup key); the trailing slug is cosmetic/SEO. Pure-slug routing would require a pre-existing DB row to resolve, which defeats lazy mirroring. titles/people still store `slug` + `tmdb_id` for stable references and Plan 3b FKs.

---

### Task 1: TMDB client + image helpers (TDD)

**Files:**
- Create: `src/lib/tmdb/client.ts`, `src/lib/tmdb/client.test.ts`, `src/lib/tmdb/images.ts`, `src/lib/tmdb/images.test.ts`, `src/lib/tmdb/types.ts`

- [ ] **Step 1: Image helpers test** — `src/lib/tmdb/images.test.ts`:

```ts
import { posterUrl, backdropUrl, profileUrl } from "./images";

test("builds poster url with default size", () => {
  expect(posterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
});
test("builds backdrop url", () => {
  expect(backdropUrl("/b.jpg")).toBe("https://image.tmdb.org/t/p/w1280/b.jpg");
});
test("builds profile url", () => {
  expect(profileUrl("/p.jpg")).toBe("https://image.tmdb.org/t/p/w185/p.jpg");
});
test("returns null for null path", () => {
  expect(posterUrl(null)).toBeNull();
  expect(profileUrl(undefined)).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/lib/tmdb/images.ts`:

```ts
const BASE = "https://image.tmdb.org/t/p";

function url(size: string, path: string | null | undefined): string | null {
  return path ? `${BASE}/${size}${path}` : null;
}
export const posterUrl = (p: string | null | undefined) => url("w500", p);
export const backdropUrl = (p: string | null | undefined) => url("w1280", p);
export const profileUrl = (p: string | null | undefined) => url("w185", p);
```

- [ ] **Step 3: Minimal TMDB types** — `src/lib/tmdb/types.ts` (only the fields we consume; everything else stays in the JSONB metadata blob):

```ts
export interface TmdbSearchItem {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string; // movie
  name?: string; // tv / person
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  profile_path?: string | null;
  overview?: string;
  known_for_department?: string;
}
export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
}
export interface TmdbVideo {
  key: string;
  site: string; // "YouTube"
  type: string; // "Trailer"
  official?: boolean;
}
export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
}
export interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
}
export interface TmdbTitleDetail {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  vote_average?: number;
  credits?: { cast?: TmdbCastMember[] };
  videos?: { results?: TmdbVideo[] };
  "watch/providers"?: { results?: Record<string, TmdbWatchProviderRegion> };
}
export interface TmdbPersonDetail {
  id: number;
  name: string;
  biography?: string;
  profile_path?: string | null;
  known_for_department?: string;
  combined_credits?: {
    cast?: (TmdbSearchItem & { character?: string })[];
  };
}
```

- [ ] **Step 4: Client test** — `src/lib/tmdb/client.test.ts` (mock fetch; assert api_key appended, append_to_response wired, error handling):

```ts
import { vi, beforeEach } from "vitest";
import { tmdb, TmdbError } from "./client";

beforeEach(() => vi.restoreAllMocks());

function mockOnce(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

test("searchMulti hits /search/multi with query and api_key", async () => {
  const spy = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
  vi.stubGlobal("fetch", spy);
  await tmdb.searchMulti("matrix");
  const calledUrl = String(spy.mock.calls[0][0]);
  expect(calledUrl).toContain("/search/multi");
  expect(calledUrl).toContain("query=matrix");
  expect(calledUrl).toContain("api_key=");
});

test("getTitle appends credits,videos,watch/providers", async () => {
  const spy = vi.fn(async () => new Response(JSON.stringify({ id: 1 }), { status: 200 }));
  vi.stubGlobal("fetch", spy);
  await tmdb.getTitle("movie", 603);
  const calledUrl = String(spy.mock.calls[0][0]);
  expect(calledUrl).toContain("/movie/603");
  expect(calledUrl).toContain("append_to_response=credits%2Cvideos%2Cwatch%2Fproviders");
});

test("throws TmdbError on non-ok", async () => {
  mockOnce(404, { status_message: "Not found" });
  await expect(tmdb.getTitle("movie", 999999999)).rejects.toBeInstanceOf(TmdbError);
});
```

- [ ] **Step 5: Run to verify failure**, then implement `src/lib/tmdb/client.ts`:

```ts
import "server-only";
import type { TmdbPersonDetail, TmdbTitleDetail, TmdbSearchItem } from "./types";

const BASE = "https://api.themoviedb.org/3";

export class TmdbError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function apiKey(): string {
  const k = process.env.TMDB_API_KEY;
  if (!k) throw new TmdbError(500, "TMDB_API_KEY is not configured");
  return k;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new TmdbError(res.status, `TMDB ${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const tmdb = {
  searchMulti: (query: string, page = 1) =>
    get<{ results: TmdbSearchItem[]; total_results: number }>("/search/multi", {
      query,
      page: String(page),
      include_adult: "false",
    }),
  getTitle: (mediaType: "movie" | "tv", id: number) =>
    get<TmdbTitleDetail>(`/${mediaType}/${id}`, {
      append_to_response: "credits,videos,watch/providers",
    }),
  getPerson: (id: number) =>
    get<TmdbPersonDetail>(`/person/${id}`, { append_to_response: "combined_credits" }),
  trending: () => get<{ results: TmdbSearchItem[] }>("/trending/all/week"),
};
```

NOTE: `next: { revalidate: 3600 }` caches TMDB responses 1h at the fetch layer (complements the DB mirror). With cacheComponents on, confirm `fetch` revalidate works in route/RSC context; if Next 16 requires `"use cache"` instead for this, the DB mirror is the real cache anyway — keep the fetch simple (the mirror in Task 2 is the durable layer). If the revalidate option causes a build/type issue, drop it.

- [ ] **Step 6: Verify** — image tests (4) + client tests (3) pass; full suite 79; `npx tsc --noEmit` clean; `npm run lint` clean.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: TMDB v3 client and image url helpers"
```

---

### Task 2: titles/people schema + slug + lazy mirror service (TDD)

**Files:**
- Modify: `src/db/schema.ts` (append titles, people tables)
- Create: `src/lib/slug.ts`, `src/lib/slug.test.ts`, `src/services/catalog.ts`, `src/services/catalog.test.ts`

- [ ] **Step 1: Slug helper test** — `src/lib/slug.test.ts`:

```ts
import { slugify, titleSlug } from "./slug";

test("slugify lowercases, strips punctuation, hyphenates", () => {
  expect(slugify("The Matrix: Reloaded!")).toBe("the-matrix-reloaded");
});
test("slugify collapses whitespace and trims hyphens", () => {
  expect(slugify("  Spider-Man   No Way Home ")).toBe("spider-man-no-way-home");
});
test("titleSlug appends year when present", () => {
  expect(titleSlug("The Matrix", "1999-03-31")).toBe("the-matrix-1999");
});
test("titleSlug omits year when missing", () => {
  expect(titleSlug("Untitled", null)).toBe("untitled");
});
test("slugify handles empty to fallback", () => {
  expect(slugify("!!!")).toBe("untitled");
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/lib/slug.ts`:

```ts
export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "untitled";
}

export function titleSlug(title: string, date: string | null | undefined): string {
  const year = date && date.length >= 4 ? date.slice(0, 4) : "";
  const base = slugify(title);
  return year ? `${base}-${year}` : base;
}
```

- [ ] **Step 3: Append schema** — `src/db/schema.ts` (merge imports; reuse existing pg-core imports, add `integer`/`jsonb` if not already imported — they are from the config tables):

```ts
export const mediaTypeEnum = pgEnum("media_type", ["movie", "tv"]);

export const titles = pgTable("titles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: mediaTypeEnum("media_type").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  releaseYear: integer("release_year"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  overview: text("overview"),
  metadata: jsonb("metadata"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("titles_tmdb_media").on(t.tmdbId, t.mediaType)]);

export const people = pgTable("people", {
  id: uuid("id").defaultRandom().primaryKey(),
  tmdbId: integer("tmdb_id").notNull().unique(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  profilePath: text("profile_path"),
  metadata: jsonb("metadata"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TitleRow = typeof titles.$inferSelect;
export type PersonRow = typeof people.$inferSelect;
```

Push: `npm run db:push -- --force` — confirm titles/people created, existing tables untouched (STOP/BLOCKED if it proposes dropping profiles/config tables).

- [ ] **Step 4: Catalog service test** — `src/services/catalog.test.ts` (live-db; mock the tmdb client so no network; assert mirror upsert + staleness). Use vi.mock on the client:

```ts
import { vi, beforeEach, afterAll } from "vitest";
import { db } from "@/db";
import { titles, people } from "@/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/tmdb/client", () => ({
  tmdb: {
    getTitle: vi.fn(),
    getPerson: vi.fn(),
  },
  TmdbError: class TmdbError extends Error {},
}));

import { tmdb } from "@/lib/tmdb/client";
import { getOrCreateTitle, getOrCreatePerson } from "./catalog";

const TMDB_ID = 99900001; // test-only synthetic id, cleaned up
const PERSON_ID = 99900002;

async function cleanup() {
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_ID));
  await db.delete(people).where(eq(people.tmdbId, PERSON_ID));
}
beforeEach(cleanup);
afterAll(cleanup);

test("getOrCreateTitle mirrors a TMDB title on first view", async () => {
  (tmdb.getTitle as any).mockResolvedValue({
    id: TMDB_ID,
    title: "Test Movie",
    overview: "x",
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    release_date: "2021-09-01",
    genres: [{ id: 1, name: "Action" }],
    credits: { cast: [{ id: 5, name: "Actor", character: "Hero", order: 0 }] },
  });
  const t = await getOrCreateTitle("movie", TMDB_ID);
  expect(t.title).toBe("Test Movie");
  expect(t.slug).toBe("test-movie-2021");
  expect(t.releaseYear).toBe(2021);
  const rows = await db.select().from(titles).where(eq(titles.tmdbId, TMDB_ID));
  expect(rows).toHaveLength(1);
});

test("getOrCreateTitle returns cached row without re-fetching when fresh", async () => {
  (tmdb.getTitle as any).mockResolvedValue({ id: TMDB_ID, title: "Test Movie", release_date: "2021-01-01" });
  await getOrCreateTitle("movie", TMDB_ID); // first: fetch + insert
  (tmdb.getTitle as any).mockClear();
  await getOrCreateTitle("movie", TMDB_ID); // second: fresh → no fetch
  expect((tmdb.getTitle as any).mock.calls.length).toBe(0);
});

test("getOrCreatePerson mirrors a person", async () => {
  (tmdb.getPerson as any).mockResolvedValue({
    id: PERSON_ID,
    name: "Jane Doe",
    profile_path: "/j.jpg",
    biography: "bio",
  });
  const p = await getOrCreatePerson(PERSON_ID);
  expect(p.name).toBe("Jane Doe");
  expect(p.slug).toBe("jane-doe");
});
```

- [ ] **Step 5: Run to verify failure**, then implement `src/services/catalog.ts`:

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { titles, people, type TitleRow, type PersonRow } from "@/db/schema";
import { tmdb } from "@/lib/tmdb/client";
import { titleSlug, slugify } from "@/lib/slug";

const STALE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isFresh(refreshedAt: Date): boolean {
  return Date.now() - new Date(refreshedAt).getTime() < STALE_MS;
}

export async function getOrCreateTitle(
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<TitleRow> {
  const [existing] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.tmdbId, tmdbId), eq(titles.mediaType, mediaType)));
  if (existing && isFresh(existing.refreshedAt)) return existing;

  const data = await tmdb.getTitle(mediaType, tmdbId);
  const name = data.title ?? data.name ?? "Untitled";
  const date = data.release_date ?? data.first_air_date ?? null;
  const year = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
  const values = {
    tmdbId,
    mediaType,
    slug: titleSlug(name, date),
    title: name,
    releaseYear: Number.isFinite(year) ? year : null,
    posterPath: data.poster_path ?? null,
    backdropPath: data.backdrop_path ?? null,
    overview: data.overview ?? null,
    metadata: data,
    refreshedAt: new Date(),
  };
  const [row] = await db
    .insert(titles)
    .values(values)
    .onConflictDoUpdate({ target: [titles.tmdbId, titles.mediaType], set: values })
    .returning();
  return row;
}

export async function getOrCreatePerson(tmdbId: number): Promise<PersonRow> {
  const [existing] = await db.select().from(people).where(eq(people.tmdbId, tmdbId));
  if (existing && isFresh(existing.refreshedAt)) return existing;

  const data = await tmdb.getPerson(tmdbId);
  const values = {
    tmdbId,
    slug: slugify(data.name),
    name: data.name,
    profilePath: data.profile_path ?? null,
    metadata: data,
    refreshedAt: new Date(),
  };
  const [row] = await db
    .insert(people)
    .values(values)
    .onConflictDoUpdate({ target: people.tmdbId, set: values })
    .returning();
  return row;
}
```

NOTE: `Date.now()` is available in normal app/server runtime (the workflow-script ban does NOT apply to app code). Tests run in Vitest where Date.now works. The 7-day staleness is fine to hardcode here (or could later become a config value — out of scope for 3a).

- [ ] **Step 6: Verify** — slug tests (5) + catalog tests (3) pass; suite 87; tsc clean; lint clean. Confirm titles/people in the live DB (a quick throwaway dotenv+neon `SELECT` of the test ids returns nothing after cleanup). Push already done in Step 3.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: titles/people schema, slug helper, lazy TMDB mirror service"
```

---

### Task 3: Catalog cards + rail components (TDD + stories)

**Files:**
- Create: `src/components/catalog/TitleCard.tsx`, `TitleCard.test.tsx`, `TitleCard.stories.tsx`, `src/components/catalog/PersonCard.tsx`, `PersonCard.stories.tsx`, `src/components/catalog/Rail.tsx`, `Rail.stories.tsx`

- [ ] **Step 1: TitleCard test** — `src/components/catalog/TitleCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { TitleCard } from "./TitleCard";

test("renders title, year, and links to detail", () => {
  render(
    <TitleCard
      href="/title/movie/603-the-matrix"
      title="The Matrix"
      year={1999}
      posterUrl="https://image.tmdb.org/t/p/w500/x.jpg"
    />,
  );
  const link = screen.getByRole("link", { name: /The Matrix/ });
  expect(link).toHaveAttribute("href", "/title/movie/603-the-matrix");
  expect(screen.getByText("1999")).toBeInTheDocument();
});

test("renders a placeholder when no poster", () => {
  render(<TitleCard href="/x" title="No Poster" year={null} posterUrl={null} />);
  expect(screen.getByText("No Poster")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/components/catalog/TitleCard.tsx`:

```tsx
import Link from "next/link";

export function TitleCard({
  href,
  title,
  year,
  posterUrl,
}: {
  href: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
}) {
  return (
    <Link href={href} className="group block w-full">
      <div className="aspect-2/3 overflow-hidden rounded-md border border-border bg-surface-overlay">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-text-muted">
            {title}
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-1 text-sm font-medium text-text">{title}</p>
      {year !== null && <p className="text-xs text-text-muted">{year}</p>}
    </Link>
  );
}
```

NOTE: uses a plain `<img>` for TMDB CDN images (not next/image) to avoid configuring remote image domains + Next image optimization for external posters — acceptable and simpler; the eslint-disable is scoped. If the project prefers next/image, configuring `images.remotePatterns` for `image.tmdb.org` in next.config is the alternative, but plain img is fine for v1.

- [ ] **Step 3: PersonCard** — `src/components/catalog/PersonCard.tsx` (similar: circular/portrait profile image or initials placeholder, name, optional subtitle like character or known-for; links to person page). Props: `{ href, name, profileUrl, subtitle? }`. Token classes; plain img with scoped eslint-disable.

- [ ] **Step 4: Rail** — `src/components/catalog/Rail.tsx` (horizontal scroll container with a heading and children):

```tsx
export function Rail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-text">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {children}
      </div>
    </section>
  );
}
```

NOTE: `[scrollbar-width:thin]` is an arbitrary CSS property utility (not a token color/size) — acceptable for a structural scrollbar hint, or omit it. Children (TitleCards) need a fixed width in a rail context; wrap each in a `w-32 shrink-0` or have callers do so — document the expectation in the story.

- [ ] **Step 5: Stories** — TitleCard.stories.tsx (Default + NoPoster), PersonCard.stories.tsx (Default + NoPhoto), Rail.stories.tsx (a rail of 6 TitleCards each in a `w-32 shrink-0` wrapper). Titles "Catalog/TitleCard", "Catalog/PersonCard", "Catalog/Rail". Import from `@storybook/nextjs-vite`.

- [ ] **Step 6: Verify** — TitleCard tests (2) pass; suite grows (87 + 2 unit + story smokes); tsc clean; lint clean; storybook builds.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: TitleCard, PersonCard, Rail catalog components"
```

---

### Task 4: Search API + search page

**Files:**
- Create: `src/lib/tmdb/transform.ts`, `src/lib/tmdb/transform.test.ts`, `src/app/api/v1/search/route.ts`, `src/app/search/page.tsx`

- [ ] **Step 1: Transform test** — `src/lib/tmdb/transform.test.ts` (maps raw TMDB search items → view models with detail hrefs + image urls; filters unsupported media types):

```ts
import { toSearchResults } from "./transform";

test("maps movie/tv/person items with hrefs and drops unknown types", () => {
  const out = toSearchResults([
    { id: 603, media_type: "movie", title: "The Matrix", release_date: "1999-03-31", poster_path: "/m.jpg" },
    { id: 1399, media_type: "tv", name: "Thrones", first_air_date: "2011-04-17", poster_path: "/t.jpg" },
    { id: 6384, media_type: "person", name: "Keanu Reeves", profile_path: "/k.jpg" },
    { id: 1, media_type: "collection" as never, name: "ignored" },
  ]);
  expect(out).toHaveLength(3);
  const movie = out.find((r) => r.kind === "title" && r.title === "The Matrix")!;
  expect(movie.href).toBe("/title/movie/603-the-matrix-1999");
  const tv = out.find((r) => r.title === "Thrones")!;
  expect(tv.href).toBe("/title/tv/1399-thrones-2011");
  const person = out.find((r) => r.kind === "person")!;
  expect(person.href).toBe("/person/6384-keanu-reeves");
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/lib/tmdb/transform.ts`:

```ts
import { titleSlug, slugify } from "@/lib/slug";
import { posterUrl, profileUrl } from "./images";
import type { TmdbSearchItem } from "./types";

export interface TitleResult {
  kind: "title";
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
}
export interface PersonResult {
  kind: "person";
  tmdbId: number;
  name: string;
  profileUrl: string | null;
  href: string;
}
export type SearchResult = TitleResult | PersonResult;

export function toSearchResults(items: TmdbSearchItem[]): SearchResult[] {
  const out: SearchResult[] = [];
  for (const it of items) {
    if (it.media_type === "movie" || it.media_type === "tv") {
      const name = it.title ?? it.name ?? "Untitled";
      const date = it.release_date ?? it.first_air_date ?? null;
      const year = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
      out.push({
        kind: "title",
        mediaType: it.media_type,
        tmdbId: it.id,
        title: name,
        year: Number.isFinite(year) ? year : null,
        posterUrl: posterUrl(it.poster_path),
        href: `/title/${it.media_type}/${it.id}-${titleSlug(name, date)}`,
      });
    } else if (it.media_type === "person") {
      out.push({
        kind: "person",
        tmdbId: it.id,
        name: it.name ?? "Unknown",
        profileUrl: profileUrl(it.profile_path),
        href: `/person/${it.id}-${slugify(it.name ?? "unknown")}`,
      });
    }
  }
  return out;
}
```

- [ ] **Step 3: Search API** — `src/app/api/v1/search/route.ts` (public; proxies TMDB multi-search, returns transformed results):

```ts
import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { toSearchResults } from "@/lib/tmdb/transform";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  try {
    const data = await tmdb.searchMulti(q);
    return NextResponse.json({ results: toSearchResults(data.results) });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Search page** — `src/app/search/page.tsx` (Server Component; reads `?q=`, calls tmdb.searchMulti server-side directly, renders results grid using TitleCard/PersonCard; Tabs to filter All/Titles/People is optional — a simple combined grid is acceptable for 3a, with a section each for Titles and People). Include a search `<form action="/search" method="get">` with an Input named `q` so the page is usable without JS. Empty `q` → prompt to search; no results → EmptyState.

- [ ] **Step 5: Verify** — transform tests (1) pass; suite grows; tsc/lint/build clean. Dev server: `GET /search?q=matrix` → 200 renders title cards; `GET /api/v1/search?q=matrix` → 200 JSON with results. Stop server.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: multi-search API and search page"
```

---

### Task 5: Title detail page (movie/TV) + cast strip + trailer

**Files:**
- Create: `src/app/title/[mediaType]/[idSlug]/page.tsx`, `src/lib/tmdb/detail.ts`, `src/lib/tmdb/detail.test.ts`, `src/components/catalog/TrailerEmbed.tsx`

- [ ] **Step 1: Detail transform test** — `src/lib/tmdb/detail.test.ts` (parse idSlug → id; pick best trailer; map cast):

```ts
import { parseIdSlug, pickTrailerKey, topCast } from "./detail";

test("parseIdSlug extracts leading integer id", () => {
  expect(parseIdSlug("603-the-matrix-1999")).toBe(603);
  expect(parseIdSlug("42")).toBe(42);
  expect(parseIdSlug("not-a-number")).toBeNull();
});

test("pickTrailerKey prefers official YouTube Trailer", () => {
  const key = pickTrailerKey([
    { key: "aaa", site: "YouTube", type: "Teaser", official: true },
    { key: "bbb", site: "YouTube", type: "Trailer", official: true },
    { key: "ccc", site: "Vimeo", type: "Trailer", official: true },
  ]);
  expect(key).toBe("bbb");
});

test("pickTrailerKey returns null when no youtube video", () => {
  expect(pickTrailerKey([{ key: "x", site: "Vimeo", type: "Trailer" }])).toBeNull();
  expect(pickTrailerKey(undefined)).toBeNull();
});

test("topCast maps and limits", () => {
  const cast = topCast(
    [
      { id: 1, name: "A", character: "X", order: 0, profile_path: "/a.jpg" },
      { id: 2, name: "B", character: "Y", order: 1, profile_path: null },
    ],
    1,
  );
  expect(cast).toHaveLength(1);
  expect(cast[0]).toMatchObject({ tmdbId: 1, name: "A", character: "X" });
  expect(cast[0].href).toBe("/person/1-a");
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/lib/tmdb/detail.ts` (parseIdSlug, pickTrailerKey preferring YouTube + type Trailer + official, topCast mapping to {tmdbId,name,character,profileUrl,href} via slugify + profileUrl, limit default 12).

- [ ] **Step 3: TrailerEmbed** — `src/components/catalog/TrailerEmbed.tsx` (client or server; a responsive YouTube iframe given a `youtubeKey`; `aspect-video w-full rounded-lg`, `title="Trailer"`, lazy). If key null, render nothing.

- [ ] **Step 4: Title detail page** — `src/app/title/[mediaType]/[idSlug]/page.tsx` (Server Component). Steps:
  - `const { mediaType, idSlug } = await params` (params is a Promise in Next 16). Validate mediaType ∈ {movie,tv} (else `notFound()`); `const id = parseIdSlug(idSlug)` (null → `notFound()`).
  - `const title = await getOrCreateTitle(mediaType, id)` (mirrors + returns row; on TmdbError 404 → `notFound()` — wrap in try/catch).
  - Read `title.metadata` as TmdbTitleDetail for cast/videos/genres/runtime/vote.
  - Render: backdrop (backdropUrl) as a banner, poster (posterUrl), title + year, genres (Badges), runtime, vote_average (a rating Badge), overview, `<TrailerEmbed youtubeKey={pickTrailerKey(metadata.videos?.results)} />`, a cast strip (Rail of PersonCards from topCast, each `w-28 shrink-0`), and a Where-to-watch placeholder section (Task 6 fills it — for now render a `<WhereToWatch ... />` that Task 6 creates; OR leave a marked TODO section and add it in Task 6). To keep tasks clean: this task renders everything EXCEPT availability; Task 6 adds `<WhereToWatch>`.
  - Add `export async function generateMetadata({ params })` returning `{ title: \`${title.title} — reco\` }` (await params, fetch the mirrored row — or derive minimally; acceptable to fetch getOrCreateTitle again, it's cached/mirrored).
  - `notFound()` import from "next/navigation".
  - Use `connection()` if needed for dynamic; but detail pages CAN be cached/PPR — they depend only on route params + TMDB (not on the user). Prefer NOT calling connection() so they can be prerendered/cached. Verify the build treats them as PPR/static-friendly. If auth or headers sneak in (they shouldn't here), reconsider.

- [ ] **Step 5: Verify** — detail tests (4) pass; suite grows; tsc/lint/build clean. Dev server: visit `/title/movie/603-the-matrix` → 200, shows The Matrix details + cast + trailer; an unknown id `/title/movie/999999999-x` → 404 page; bad mediaType `/title/book/1-x` → 404. Stop server.

- [ ] **Step 6: Commit**

```
git add -A
git commit -m "feat: movie/TV detail page with cast strip and trailer"
```

---

### Task 6: Where-to-watch (streaming availability)

**Files:**
- Create: `src/lib/tmdb/providers.ts`, `src/lib/tmdb/providers.test.ts`, `src/components/catalog/ProviderLogoRow.tsx`, `ProviderLogoRow.stories.tsx`, `src/components/catalog/WhereToWatch.tsx`
- Modify: `src/app/title/[mediaType]/[idSlug]/page.tsx` (render `<WhereToWatch>`)

- [ ] **Step 1: Providers transform test** — `src/lib/tmdb/providers.test.ts`:

```ts
import { providersForRegion } from "./providers";

const watch = {
  results: {
    US: {
      link: "https://www.themoviedb.org/movie/603/watch?locale=US",
      flatrate: [{ provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg" }],
      rent: [{ provider_id: 2, provider_name: "Apple TV", logo_path: "/a.jpg" }],
    },
    GB: { flatrate: [{ provider_id: 9, provider_name: "Prime", logo_path: "/p.jpg" }] },
  },
};

test("returns grouped providers + link for a region", () => {
  const r = providersForRegion(watch, "US");
  expect(r).not.toBeNull();
  expect(r!.link).toContain("themoviedb.org");
  expect(r!.flatrate.map((p) => p.name)).toEqual(["Netflix"]);
  expect(r!.rent.map((p) => p.name)).toEqual(["Apple TV"]);
  expect(r!.buy).toEqual([]);
});

test("null when region absent", () => {
  expect(providersForRegion(watch, "NG")).toBeNull();
  expect(providersForRegion(undefined, "US")).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/lib/tmdb/providers.ts` — `providersForRegion(watchProviders, region)` returns `{ link, flatrate, rent, buy }` (each provider mapped to `{id,name,logoUrl}` using a TMDB logo url helper at size w92 — add `logoUrl` to images.ts or inline `https://image.tmdb.org/t/p/w92{logo_path}`), or null if the region key is absent. Group order: flatrate (stream), rent, buy.

- [ ] **Step 3: ProviderLogoRow** — `src/components/catalog/ProviderLogoRow.tsx` (props `{ label, providers: {id,name,logoUrl}[] }`; renders a labeled row of provider logos with name alt text; returns null if empty). Story "Catalog/ProviderLogoRow".

- [ ] **Step 4: WhereToWatch** — `src/components/catalog/WhereToWatch.tsx` (props `{ watchProviders, region }`). Computes `providersForRegion`; if null → EmptyState "No streaming info for {region}"; else render Stream/Rent/Buy ProviderLogoRows + a "Powered by JustWatch" attribution line + a link to the TMDB watch page. Region for v1: default "US" (a constant; Plan 3b/profile region wires the user's actual region — note this). 

- [ ] **Step 5: Wire into detail page** — add `<WhereToWatch watchProviders={metadata["watch/providers"]} region="US" />` to the title detail page in an appropriate section.

- [ ] **Step 6: Verify** — providers tests (2) pass; suite grows; tsc/lint/build clean. Dev server: `/title/movie/603-the-matrix` shows a Where-to-watch section (providers if available in US, else the empty state) + JustWatch attribution. Stop server.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: where-to-watch streaming availability with JustWatch attribution"
```

---

### Task 7: Person page + filmography

**Files:**
- Create: `src/app/person/[idSlug]/page.tsx`, `src/lib/tmdb/person.ts`, `src/lib/tmdb/person.test.ts`

- [ ] **Step 1: Person transform test** — `src/lib/tmdb/person.test.ts` (map combined_credits.cast → known-for title results, dedup by id, sort by popularity/vote or release recency, filter movie/tv only):

```ts
import { filmography } from "./person";

test("maps combined credits to title results, newest first, movie/tv only", () => {
  const out = filmography({
    cast: [
      { id: 1, media_type: "movie", title: "Old", release_date: "1999-01-01", poster_path: "/o.jpg", character: "A" },
      { id: 2, media_type: "tv", name: "New Show", first_air_date: "2022-01-01", poster_path: "/n.jpg", character: "B" },
      { id: 3, media_type: "person" as never, name: "ignored" },
      { id: 1, media_type: "movie", title: "Old", release_date: "1999-01-01" }, // dup id
    ],
  });
  expect(out.map((t) => t.tmdbId)).toEqual([2, 1]); // newest first, deduped
  expect(out[0].href).toBe("/title/tv/2-new-show-2022");
});

test("handles missing credits", () => {
  expect(filmography(undefined)).toEqual([]);
  expect(filmography({})).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/lib/tmdb/person.ts` — `filmography(combinedCredits)` → `TitleResult[]` (reuse the TitleResult shape/href logic from transform.ts; dedup by tmdbId, sort by date desc with undated last, filter movie/tv).

- [ ] **Step 3: Person page** — `src/app/person/[idSlug]/page.tsx` (Server Component): parse idSlug → id (notFound on null); `getOrCreatePerson(id)` (TmdbError 404 → notFound); render profile image (profileUrl), name, known_for_department, biography (truncated/expandable is optional — plain paragraph fine), and a filmography grid of TitleCards from `filmography(metadata.combined_credits)`. generateMetadata with the person name. No connection() (cacheable, user-independent).

- [ ] **Step 4: Verify** — person tests (2) pass; suite grows; tsc/lint/build clean. Dev server: `/person/6384-keanu-reeves` → 200 shows bio + filmography grid; bad id → 404. Stop server.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: person page with filmography"
```

---

### Task 8: Home trending rails + Plan 3a close-out

**Files:**
- Modify: `src/app/page.tsx` (replace the placeholder home with trending rails)
- Modify: `src/components/layout/PageShell.tsx` usage OR `src/app/layout.tsx` footer (add TMDB attribution to the footer) — and add a search box to the header
- Create: `e2e/catalog.spec.ts`
- Modify: `task-list.md`, `handoff.md`

- [ ] **Step 1: Home page** — `src/app/page.tsx` (Server Component): call `tmdb.trending()`, transform via `toSearchResults`, render a hero/intro + a `Rail title="Trending this week"` of TitleCards (titles only; people from trending can be dropped or shown in a small row). Each TitleCard wrapped `w-32 shrink-0`. On TMDB error → render the rail empty with a friendly note (don't crash the home page). Keep the brand greeting (getCurrentProfile) if desired, or simplify — but do NOT break the existing signed-in greeting behavior unless replaced intentionally. Reasonable: show trending below a short brand intro.

- [ ] **Step 2: Header search + footer attribution.**
  - Footer: in the root layout's PageShell `footer` slot (currently empty/placeholder), add the required attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB." plus "Streaming data powered by JustWatch." Render as small muted text with links. (TMDB attribution is a TOS requirement — must be present.)
  - Header search: add a small search form (GET to /search, input name q) into the PageShell header — either via a new `actions`-adjacent slot or by extending PageShell to accept a `search` slot. Keep PageShell's existing API stable; adding an optional `search?: React.ReactNode` prop rendered in the header is clean. Update the layout to pass a simple search form. (A Client island isn't required — a plain GET form works.)

- [ ] **Step 3: Catalog e2e** — `e2e/catalog.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("home shows a trending rail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /trending/i })).toBeVisible({ timeout: 15000 });
});

test("search returns results and links to a title", async ({ page }) => {
  await page.goto("/search?q=matrix");
  const firstTitle = page.getByRole("link", { name: /matrix/i }).first();
  await expect(firstTitle).toBeVisible({ timeout: 15000 });
});

test("title detail page renders", async ({ page }) => {
  await page.goto("/title/movie/603-the-matrix");
  await expect(page.getByRole("heading", { name: /matrix/i }).first()).toBeVisible({ timeout: 15000 });
});

test("footer shows TMDB attribution", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/TMDB/i)).toBeVisible();
});
```

NOTE: these e2e hit the live TMDB API through the dev server (network-dependent). Generous timeouts. If TMDB is flaky in CI, that's a known external dependency — document it. They prove the read path end-to-end.

- [ ] **Step 4: Full gates** — clean `.next`, then `npm run build` (succeeds), `npm run test` (all green), `npm run test:e2e` (6 prior + 4 catalog = 10; note any TMDB-network flakiness), `npx tsc --noEmit` clean, `npm run lint` clean.

- [ ] **Step 5: Tracking** — `task-list.md`: add a `## Plan 3a: Catalog core` section with T1–T8 checked, and a `## Plan 3b: Watchlists, ratings, browse — not yet planned` line. `handoff.md`: dated entry — catalog read surfaces complete (TMDB v3 client + lazy mirror, titles/people tables, search, movie/tv detail w/ cast+trailer+where-to-watch, person filmography, trending home, TMDB+JustWatch attribution, header search). Note route shape `/title/[mediaType]/[id]-[slug]` + `/person/[id]-[slug]`, region hardcoded "US" pending profile wiring in 3b, plain `<img>` for TMDB CDN. Next: Plan 3b.

- [ ] **Step 6: Final commit**

```
git add -A
git commit -m "feat: trending home, header search, TMDB attribution; close out Plan 3a"
```

---

## Plan Self-Review (completed)

- **Spec coverage (sections 3 + 6 read surfaces):** lazy TMDB mirror ✓ (T2, getOrCreate + 7-day staleness), titles/people tables ✓ (T2), cast search ✓ (T4 multi-search includes people + T7 person pages), title detail with cast strip + trailer ✓ (T5), where-to-watch region-aware + attribution ✓ (T6), person filmography ✓ (T7), search page ✓ (T4), home trending ✓ (T8), components TitleCard/PersonCard/Rail/ProviderLogoRow ✓ (T3/T6). Deferred to Plan 3b: watchlist + ratings (need the titles table from T2 as FK target — correct ordering), browse/discover `/movies` `/tv` with filters, wiring the user's profile region into where-to-watch.
- **Placeholders:** none — client/services/transforms have full code + tests; pages (T4/T5/T7/T8) give explicit step lists + which components/services to compose (appropriate for RSC pages), with exact route/param handling and notFound cases.
- **Type/seam consistency:** TitleResult/PersonResult (T4 transform) reused by T7 filmography; getOrCreateTitle/getOrCreatePerson (T2) consumed by T5/T7 pages; parseIdSlug (T5) used by T5+T7 routes; TmdbTitleDetail.metadata (T2 stores raw `data`) read by T5/T6 (cast/videos/watch-providers) — the client's append_to_response (credits,videos,watch/providers) is what populates those metadata fields, consistent end-to-end; image helpers (T1) used across cards/detail/providers.
- **Risk note:** TMDB network dependency in e2e (T8) — documented; unit tests mock fetch/client so they're deterministic. cacheComponents: detail/person/home pages are user-independent and should be PPR/cacheable (no connection()); admin/auth pages remain dynamic — no conflict.
