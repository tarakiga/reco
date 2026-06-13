# Plan 3b: Watchlists, Ratings & Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-user catalog data — watchlist (want/watching/watched) and star ratings on title pages, a `/watchlist` page, browse/discover pages for movies and TV with filters, and the user's region wired into where-to-watch — completing the catalog MVP and laying the data foundation for the AI taste layer.

**Architecture:** New `watchlist_items` and `ratings` tables FK to `titles.id` (local mirror) and `profiles.id` (Clerk-backed identity). Title detail pages stay PPR-cacheable (user-independent shell); a **client island** (`TitleActions`) fetches the signed-in user's status/rating for that title via React Query against authed `/api/v1/me/*` routes and mutates them — so user state never forces the page dynamic. The API accepts `(mediaType, tmdbId)` and resolves to the local title row via `getOrCreateTitle` (lazy mirror) before writing, so any title is trackable even if never viewed. Browse uses TMDB's `/discover` endpoint with genre/year filters via a plain GET form (no JS required).

**Tech Stack:** Next.js 16 (App Router, cacheComponents/PPR), Drizzle + Neon, Zod, React Query, existing component library + catalog components, TMDB API.

**Spec:** `docs/superpowers/specs/2026-06-12-reco-v1-design.md` sections 4 (schema: watchlist_items, ratings), 5 (API: me/watchlist, me/ratings, me/profile), 6 (pages: /movies, /tv browse, /watchlist).

**Decision — rating scale (deviation from spec, with rationale):** spec says "score 1–10 displayed as 5 stars with halves." This plan uses **5 whole stars, score 1–5 integer** — simpler, fully accessible (radiogroup), no half-click hit-testing, and the conventional UX (matches the old rizmos ACF star field). If half-star granularity is wanted later, migrate score to 1–10; the StarRating API (`value`, `onChange`, `max`) accommodates it.

**Conventions:** repo root `D:\work\Tar\PROJECTS\reco`, branch `plan-3b-user-data` (create from master at start). Commit after every task. TDD for services (live-db, `__vitest__`-isolated, cleaned up) and components/transforms. Authed routes use `getCurrentProfile()` (returns null when signed out → 401 via the existing `requireRole`/authz patterns, or an inline 401). Client islands talk to the API via React Query + the existing `adminFetch`-style client (or a new `meFetch` — see T2). Never print env values. Never touch `D:\wamp64\www\rizmos`.

---

### Task 1: watchlist/ratings schema + services (TDD)

**Files:**
- Modify: `src/db/schema.ts` (append watchlist_items, ratings)
- Create: `src/services/user-catalog.ts`, `src/services/user-catalog.test.ts`

- [ ] **Step 1: Append schema** to `src/db/schema.ts` (merge imports; `profiles`/`titles` already defined):

```ts
export const watchStatusEnum = pgEnum("watch_status", ["want_to_watch", "watching", "watched"]);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").notNull().references(() => titles.id, { onDelete: "cascade" }),
    status: watchStatusEnum("status").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })],
);

export const ratings = pgTable(
  "ratings",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").notNull().references(() => titles.id, { onDelete: "cascade" }),
    score: integer("score").notNull(), // 1..5
    ratedAt: timestamp("rated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })],
);

export type WatchlistItemRow = typeof watchlistItems.$inferSelect;
export type RatingRow = typeof ratings.$inferSelect;
```

Add `primaryKey` to the `drizzle-orm/pg-core` import. Push: `npm run db:push -- --force` (if the drizzle-kit TTY prompt bug blocks it — as in Plan 3a T2 — apply the equivalent DDL directly via a one-off Neon SQL statement matching the schema EXACTLY: two tables with composite PKs, FKs to profiles(id)/titles(id) ON DELETE CASCADE, the `watch_status` enum). Confirm additive only (existing tables untouched). Verify the live DB matches the Drizzle definitions (introspect column types, PK, FK, enum) before proceeding.

- [ ] **Step 2: Service test** — `src/services/user-catalog.test.ts` (live-db; seed a profile + title with synthetic ids, exercise services, cleanup). The services take a `userId` (profiles.id) + a resolved `titleId`:

```ts
import { afterAll, beforeAll } from "vitest";
import { db } from "@/db";
import { profiles, titles, watchlistItems, ratings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  setWatchStatus,
  removeFromWatchlist,
  listWatchlist,
  setRating,
  removeRating,
  getTitleState,
} from "./user-catalog";

const CLERK = "__vitest__clerk_uc";
const TMDB_ID = 99911001;
let userId: string;
let titleId: string;

beforeAll(async () => {
  await cleanup();
  const [p] = await db.insert(profiles).values({ clerkUserId: CLERK, username: "__vitest__uc_user" }).returning();
  userId = p.id;
  const [t] = await db.insert(titles).values({
    tmdbId: TMDB_ID, mediaType: "movie", slug: "uc-test-2020", title: "UC Test", releaseYear: 2020,
  }).returning();
  titleId = t.id;
});
afterAll(cleanup);

async function cleanup() {
  await db.delete(profiles).where(eq(profiles.clerkUserId, CLERK)); // cascades watchlist/ratings
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_ID));
}

test("setWatchStatus upserts and listWatchlist returns it", async () => {
  await setWatchStatus(userId, titleId, "want_to_watch");
  await setWatchStatus(userId, titleId, "watching"); // upsert
  const list = await listWatchlist(userId);
  expect(list).toHaveLength(1);
  expect(list[0].status).toBe("watching");
  expect(list[0].title).toBe("UC Test");
});

test("setRating upserts; getTitleState returns status + score", async () => {
  await setRating(userId, titleId, 4);
  await setRating(userId, titleId, 5);
  const state = await getTitleState(userId, titleId);
  expect(state).toEqual({ status: "watching", score: 5 });
});

test("remove clears watchlist and rating", async () => {
  await removeFromWatchlist(userId, titleId);
  await removeRating(userId, titleId);
  const state = await getTitleState(userId, titleId);
  expect(state).toEqual({ status: null, score: null });
  expect(await listWatchlist(userId)).toHaveLength(0);
});
```

- [ ] **Step 3: Run to verify failure**, then implement `src/services/user-catalog.ts`:

```ts
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ratings, titles, watchlistItems } from "@/db/schema";

export type WatchStatus = "want_to_watch" | "watching" | "watched";

export async function setWatchStatus(userId: string, titleId: string, status: WatchStatus) {
  await db
    .insert(watchlistItems)
    .values({ userId, titleId, status, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [watchlistItems.userId, watchlistItems.titleId],
      set: { status, updatedAt: new Date() },
    });
}

export async function removeFromWatchlist(userId: string, titleId: string) {
  await db
    .delete(watchlistItems)
    .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.titleId, titleId)));
}

export async function setRating(userId: string, titleId: string, score: number) {
  await db
    .insert(ratings)
    .values({ userId, titleId, score, ratedAt: new Date() })
    .onConflictDoUpdate({
      target: [ratings.userId, ratings.titleId],
      set: { score, ratedAt: new Date() },
    });
}

export async function removeRating(userId: string, titleId: string) {
  await db.delete(ratings).where(and(eq(ratings.userId, userId), eq(ratings.titleId, titleId)));
}

export interface WatchlistEntry {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  slug: string;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
  status: WatchStatus;
}

export async function listWatchlist(userId: string): Promise<WatchlistEntry[]> {
  const rows = await db
    .select({
      titleId: titles.id,
      tmdbId: titles.tmdbId,
      mediaType: titles.mediaType,
      slug: titles.slug,
      title: titles.title,
      releaseYear: titles.releaseYear,
      posterPath: titles.posterPath,
      status: watchlistItems.status,
    })
    .from(watchlistItems)
    .innerJoin(titles, eq(watchlistItems.titleId, titles.id))
    .where(eq(watchlistItems.userId, userId))
    .orderBy(desc(watchlistItems.updatedAt));
  return rows;
}

export async function getTitleState(
  userId: string,
  titleId: string,
): Promise<{ status: WatchStatus | null; score: number | null }> {
  const [w] = await db
    .select({ status: watchlistItems.status })
    .from(watchlistItems)
    .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.titleId, titleId)));
  const [r] = await db
    .select({ score: ratings.score })
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.titleId, titleId)));
  return { status: w?.status ?? null, score: r?.score ?? null };
}
```

- [ ] **Step 4: Verify** — 3 service tests pass; full suite 110; `npx tsc --noEmit` clean; `npm run lint` clean. Confirm cleanup left no synthetic rows.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: watchlist/ratings schema and user-catalog service"
```

---

### Task 2: Authed me/* API routes

**Files:**
- Create: `src/lib/contracts/me.ts`, `src/lib/me-client.ts`, `src/lib/me-client.test.ts`, and routes:
  - `src/app/api/v1/me/title-state/route.ts`
  - `src/app/api/v1/me/watchlist/route.ts`
  - `src/app/api/v1/me/ratings/route.ts`
  - `src/app/api/v1/me/profile/route.ts`

- [ ] **Step 1: Contracts** — `src/lib/contracts/me.ts` (Zod):

```ts
import { z } from "zod";

export const mediaType = z.enum(["movie", "tv"]);
export const watchStatus = z.enum(["want_to_watch", "watching", "watched"]);

export const titleRef = z.object({ mediaType, tmdbId: z.number().int().positive() });
export const setWatchInput = titleRef.extend({ status: watchStatus });
export const setRatingInput = titleRef.extend({ score: z.number().int().min(1).max(5) });
export const updateProfileInput = z.object({ region: z.string().length(2).toUpperCase() });

export type SetWatchInput = z.infer<typeof setWatchInput>;
export type SetRatingInput = z.infer<typeof setRatingInput>;
```

- [ ] **Step 2: me-client test** — `src/lib/me-client.test.ts` (mirror the admin-client test: returns json on ok, throws on error, sends JSON body). Implement `src/lib/me-client.ts` with `meFetch<T>(url, {method, body})` + `MeApiError{status,message}` — identical shape to `src/lib/admin-client.ts` (you may even re-export/share, but a dedicated module keeps concerns separate). Write 3 tests like admin-client's, observe failure, implement.

- [ ] **Step 3: title-state route** — `src/app/api/v1/me/title-state/route.ts`:

```ts
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { getOrCreateTitle } from "@/services/catalog";
import { getTitleState } from "@/services/user-catalog";
import { mediaType } from "@/lib/contracts/me";

export async function GET(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ status: null, score: null, signedIn: false });
  const url = new URL(req.url);
  const mt = mediaType.safeParse(url.searchParams.get("mediaType"));
  const tmdbId = Number(url.searchParams.get("tmdbId"));
  if (!mt.success || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "mediaType and tmdbId required" }, { status: 400 });
  }
  const title = await getOrCreateTitle(mt.data, tmdbId);
  const state = await getTitleState(profile.id, title.id);
  return NextResponse.json({ ...state, signedIn: true });
}
```

NOTE: signed-out returns `{status:null,score:null,signedIn:false}` (200, not 401) so the island can render a "sign in to track" affordance without treating it as an error. Mutations below DO 401 when signed out.

- [ ] **Step 4: watchlist route** — `src/app/api/v1/me/watchlist/route.ts`:
  - `GET` → `await connection()`, requireProfile (401 if null), `listWatchlist(profile.id)` → {items}.
  - `PUT` → requireProfile (401), parse `setWatchInput`, `getOrCreateTitle(mediaType, tmdbId)`, `setWatchStatus(profile.id, title.id, status)` → {ok:true}.
  - `DELETE` → requireProfile (401), parse titleRef from body (or query), `getOrCreateTitle`, `removeFromWatchlist` → {ok:true}.
  Use a small local helper `requireProfile()` that returns the profile or throws/returns a 401 response. Validation errors → 400; bad JSON → 400.

- [ ] **Step 5: ratings route** — `src/app/api/v1/me/ratings/route.ts`: `PUT` (setRatingInput → setRating), `DELETE` (titleRef → removeRating). 401 when signed out.

- [ ] **Step 6: profile route** — `src/app/api/v1/me/profile/route.ts`: `PATCH` (updateProfileInput → update profiles.region for the current user); `GET` → {username, region, role}. 401 when signed out. (Add an `updateRegion(userId, region)` to user-catalog.ts or a profile service — wherever cleanest; a 1-liner `db.update(profiles).set({region}).where(eq(profiles.id, userId))`.)

- [ ] **Step 7: Verify** — me-client tests (3) pass; suite grows; `npx tsc --noEmit` clean; `npm run build` succeeds (me/* routes dynamic); `npm run lint` clean. Functional smoke (signed-out): dev server, `GET /api/v1/me/title-state?mediaType=movie&tmdbId=603` → 200 `{signedIn:false,...}`; `PUT /api/v1/me/watchlist` body `{}` → 401; `GET /api/v1/me/watchlist` → 401. Stop server.

- [ ] **Step 8: Commit**

```
git add -A
git commit -m "feat: authed me/* API (title-state, watchlist, ratings, profile)"
```

---

### Task 3: StarRating component (TDD + story)

**Files:**
- Create: `src/components/ui/StarRating.tsx`, `StarRating.test.tsx`, `StarRating.stories.tsx`

- [ ] **Step 1: Test** — `src/components/ui/StarRating.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StarRating } from "./StarRating";

test("renders max stars as radio options", () => {
  render(<StarRating value={0} onChange={() => {}} />);
  expect(screen.getAllByRole("radio")).toHaveLength(5);
});

test("marks the current value selected", () => {
  render(<StarRating value={3} onChange={() => {}} />);
  expect(screen.getByRole("radio", { name: "3 stars" })).toBeChecked();
});

test("calls onChange with the clicked star", async () => {
  const onChange = vi.fn();
  render(<StarRating value={0} onChange={onChange} />);
  await userEvent.click(screen.getByRole("radio", { name: "4 stars" }));
  expect(onChange).toHaveBeenCalledWith(4);
});

test("readOnly renders no radios", () => {
  render(<StarRating value={3} readOnly />);
  expect(screen.queryAllByRole("radio")).toHaveLength(0);
  expect(screen.getByLabelText("Rated 3 out of 5")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**, then implement `src/components/ui/StarRating.tsx`:

```tsx
"use client";
import { cn } from "@/lib/cn";

export function StarRating({
  value,
  onChange,
  max = 5,
  readOnly = false,
}: {
  value: number;
  onChange?: (score: number) => void;
  max?: number;
  readOnly?: boolean;
}) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  if (readOnly) {
    return (
      <div className="inline-flex items-center gap-0.5" aria-label={`Rated ${value} out of ${max}`}>
        {stars.map((s) => (
          <Star key={s} filled={s <= value} />
        ))}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label="Rate this title" className="inline-flex items-center gap-0.5">
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s === value}
          aria-label={`${s} star${s === 1 ? "" : "s"}`}
          onClick={() => onChange?.(s)}
          className="p-0.5 text-text-muted transition-colors hover:text-warning focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Star filled={s <= value} />
        </button>
      ))}
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("size-5", filled ? "fill-warning" : "fill-transparent stroke-current")} aria-hidden>
      <path
        strokeWidth="1.5"
        d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.6 1-5.8L1.5 7.7l5.9-.9z"
      />
    </svg>
  );
}
```

NOTE: `aria-checked={s === value}` — only the exact star is "checked" (radio semantics); the visual fill uses `s <= value`. The test checks `getByRole("radio",{name:"3 stars"})` is checked when value=3. Confirm the aria-label pluralization matches ("3 stars", "1 star", "4 stars").

- [ ] **Step 3: Story** — `src/components/ui/StarRating.stories.tsx` (title "Primitives/StarRating"; Interactive with useState, ReadOnly at value 4). Import from `@storybook/nextjs-vite`.

- [ ] **Step 4: Verify** — 4 StarRating tests pass; suite grows; tsc/lint clean; storybook builds.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: StarRating component (5-star, accessible radiogroup)"
```

---

### Task 4: TitleActions island wired into the detail page

**Files:**
- Create: `src/components/catalog/TitleActions.tsx`, `src/components/catalog/useTitleState.ts`
- Modify: `src/app/title/[mediaType]/[idSlug]/page.tsx` (render `<TitleActions mediaType tmdbId />`)

- [ ] **Step 1: Hooks** — `src/components/catalog/useTitleState.ts` (client; React Query against me/* via meFetch):

```tsx
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";

interface TitleState { status: string | null; score: number | null; signedIn: boolean }

export function useTitleState(mediaType: "movie" | "tv", tmdbId: number) {
  return useQuery({
    queryKey: ["title-state", mediaType, tmdbId],
    queryFn: () =>
      meFetch<TitleState>(`/api/v1/me/title-state?mediaType=${mediaType}&tmdbId=${tmdbId}`),
  });
}

export function useSetWatch(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) =>
      meFetch("/api/v1/me/watchlist", { method: "PUT", body: { mediaType, tmdbId, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] }),
  });
}

export function useRemoveWatch(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => meFetch("/api/v1/me/watchlist", { method: "DELETE", body: { mediaType, tmdbId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] }),
  });
}

export function useSetRating(mediaType: "movie" | "tv", tmdbId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (score: number) =>
      meFetch("/api/v1/me/ratings", { method: "PUT", body: { mediaType, tmdbId, score } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["title-state", mediaType, tmdbId] }),
  });
}
```

- [ ] **Step 2: TitleActions** — `src/components/catalog/TitleActions.tsx` (client island). Props `{ mediaType, tmdbId }`. Requirements:
  - `useTitleState`. While loading → a Skeleton row. 
  - If `!data.signedIn` → render a muted "Sign in to add to your watchlist and rate" with a link to `/sign-in`.
  - Signed in: a watchlist control — a `Select` (or a row of Buttons / a `Tabs`) for status ∈ {none, want_to_watch, watching, watched}. Choosing a status calls `useSetWatch`; choosing "none" calls `useRemoveWatch`. Label them human-readably ("Want to watch", "Watching", "Watched", "Not tracking"). Show current status from `data.status`.
  - A `StarRating` (interactive) bound to `data.score ?? 0`; on change calls `useSetRating`.
  - Toast feedback ("Added to watchlist", "Rated {n} stars", "Removed") via `useToast`; error → toast err.message.
  - Token classes only.
- [ ] **Step 3: Wire into detail page** — render `<TitleActions mediaType={mediaType} tmdbId={id} />` in the title detail page header area (near the title/overview). The page stays a Server Component (PPR) — TitleActions is the only client part and self-fetches user state, so the page does NOT become user-dynamic.

- [ ] **Step 4: Verify** — tsc/lint/build clean; suite green; `/title/movie/603-the-matrix` still builds PPR (the island doesn't force the page dynamic). Signed-out dev check: the title page renders, and the actions area shows the "sign in to track" prompt (island's title-state returns signedIn:false). Report. Signed-in CRUD is manual/e2e.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat: TitleActions island (watchlist + rating) on detail page"
```

---

### Task 5: /watchlist page

**Files:**
- Create: `src/app/watchlist/page.tsx`

- [ ] **Step 1: Page** — `src/app/watchlist/page.tsx` (Server Component, user-specific → dynamic):
  - `await connection();` then `const profile = await getCurrentProfile();` — if null, render a signed-out state: an EmptyState "Sign in to see your watchlist" with a link to `/sign-in`. (Do NOT redirect — a friendly prompt is better UX here; the route is not secret.)
  - If signed in: `const items = await listWatchlist(profile.id);` Group by status (want_to_watch / watching / watched). For each non-empty group, a heading + a responsive grid of `TitleCard` (href `/title/${mediaType}/${tmdbId}-${slug}`, posterUrl via `posterUrl(item.posterPath)`, title, year=releaseYear). If the whole watchlist is empty → EmptyState "Your watchlist is empty" with a "Browse titles" link to `/movies`.
  - `generateMetadata` → `{ title: "Your watchlist — reco" }` (static).
- [ ] **Step 2: Add a nav/header link** to `/watchlist` — simplest: it's already reachable; optionally add it to the interim nav fallback OR leave nav as-is (config-driven). Not required; skip if it complicates. (A signed-in user reaches it via a link you add to the header actions or the TitleActions, optional.)

- [ ] **Step 3: Verify** — tsc/lint/build clean; suite green. Signed-out `/watchlist` → 200 with the sign-in prompt (NOT a redirect, NOT a crash). Report. Signed-in list is manual/e2e.

- [ ] **Step 4: Commit**

```
git add -A
git commit -m "feat: watchlist page grouped by status"
```

---

### Task 6: Browse /movies and /tv with filters

**Files:**
- Create: `src/lib/tmdb/discover.ts`, `src/lib/tmdb/discover.test.ts`, `src/components/catalog/FilterBar.tsx`, `src/app/movies/page.tsx`, `src/app/tv/page.tsx`
- Modify: `src/lib/tmdb/client.ts` (add `discover` method)

- [ ] **Step 1: Add discover to the client** — in `src/lib/tmdb/client.ts`, add:

```ts
  discover: (mediaType: "movie" | "tv", params: Record<string, string>) =>
    get<{ results: TmdbSearchItem[]; total_pages: number }>(`/discover/${mediaType}`, params),
  genres: (mediaType: "movie" | "tv") =>
    get<{ genres: { id: number; name: string }[] }>(`/genre/${mediaType}/list`),
```

(TMDB discover items lack `media_type`; the transform must inject it — see Step 3.)

- [ ] **Step 2: Discover transform test** — `src/lib/tmdb/discover.test.ts`:

```ts
import { toBrowseResults, buildDiscoverParams } from "./discover";

test("toBrowseResults injects mediaType and builds title hrefs", () => {
  const out = toBrowseResults("movie", [
    { id: 603, title: "The Matrix", release_date: "1999-03-31", poster_path: "/m.jpg" } as never,
  ]);
  expect(out[0]).toMatchObject({ kind: "title", mediaType: "movie", tmdbId: 603 });
  expect(out[0].href).toBe("/title/movie/603-the-matrix-1999");
});

test("buildDiscoverParams maps genre/year/sort, omitting blanks", () => {
  expect(buildDiscoverParams("movie", { genre: "28", year: "1999" })).toMatchObject({
    with_genres: "28",
    primary_release_year: "1999",
    sort_by: "popularity.desc",
    include_adult: "false",
  });
  const tv = buildDiscoverParams("tv", { year: "2011" });
  expect(tv.first_air_date_year).toBe("2011");
  expect(tv.with_genres).toBeUndefined();
});
```

- [ ] **Step 3: Run to verify failure**, then implement `src/lib/tmdb/discover.ts`:
  - `toBrowseResults(mediaType, items)`: map each item to a `TitleResult` (reuse the shape from `transform.ts`) injecting `media_type: mediaType` (discover omits it). Build href via the same `/title/${mediaType}/${id}-${titleSlug(name,date)}` pattern.
  - `buildDiscoverParams(mediaType, filters: {genre?, year?})`: returns a `Record<string,string>` with `sort_by: "popularity.desc"`, `include_adult: "false"`, `with_genres` when genre set, and the year param keyed by media type (`primary_release_year` for movie, `first_air_date_year` for tv). Omit blanks.

- [ ] **Step 4: FilterBar** — `src/components/catalog/FilterBar.tsx` (Client or server-rendered plain form; a GET `<form>` with a genre `Select` (options passed in as `{id,name}[]`) and a year `Select` or `Input`, plus a submit Button. Pre-selects current values from props. Token classes). Props `{ action: string; genres: {id:number;name:string}[]; selected: {genre?: string; year?: string} }`. Works without JS (GET form to the same route).

- [ ] **Step 5: Browse pages** — `src/app/movies/page.tsx` and `src/app/tv/page.tsx` (Server Components; async `searchParams: Promise<{genre?:string; year?:string}>`):
  - Read filters from searchParams. Fetch genres (`tmdb.genres(mediaType)`) for the FilterBar. Fetch results (`tmdb.discover(mediaType, buildDiscoverParams(mediaType, filters))`), transform via `toBrowseResults`. Render an `<h1>` ("Movies" / "TV Shows"), the `<FilterBar action="/movies" genres={...} selected={...} />`, then a responsive grid of `TitleCard`. EmptyState if no results. Wrap TMDB calls in try/catch → friendly empty/error state.
  - These read searchParams (dynamic) — fine. Wrap the genres+discover calls so a TMDB error doesn't crash the page.
  - `generateMetadata` static ("Movies — reco" / "TV Shows — reco").

- [ ] **Step 6: Verify** — discover tests (2) pass; suite grows; tsc/lint/build clean. Dev server: `/movies` → 200 grid + filter bar; `/movies?genre=28&year=2000` → 200 filtered; `/tv` → 200. Stop server. Report.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: browse /movies and /tv with genre/year filters"
```

---

### Task 7: Region wiring + Plan 3b close-out

**Files:**
- Create: `src/components/catalog/RegionSelect.tsx` (client island for changing region)
- Modify: `src/app/title/[mediaType]/[idSlug]/page.tsx` (use the viewer's region for where-to-watch when signed in), `src/app/watchlist/page.tsx` OR a small profile area (render RegionSelect), `e2e/user-data.spec.ts` (new), `task-list.md`, `handoff.md`

- [ ] **Step 1: Region for where-to-watch.** The title detail page is currently PPR (user-independent) and passes `region="US"` to `<WhereToWatch>`. To respect the user's region WITHOUT making the whole page dynamic, move where-to-watch into a small client island OR accept that personalized region requires dynamic rendering. SIMPLEST correct approach for v1: keep the page PPR with a default region from a constant, and make the WhereToWatch region come from a **client island** `WhereToWatchClient` that reads the user's region via a lightweight `GET /api/v1/me/profile` (returns region; defaults "US" when signed out) and re-renders providers for that region using the already-embedded `watch/providers` metadata. Pass the full `watch/providers` object to the client island as a prop (it's already in the page's `meta`), and the island picks the region. This keeps the page cacheable and personalizes availability per signed-in user. Implement `WhereToWatchClient` (client) wrapping the existing pure `providersForRegion` + `ProviderLogoRow` (reuse the presentational pieces from Plan 3a; the existing server `WhereToWatch` can stay for the default, or be replaced by the client one — choose one path and keep it clean). Default region "US" until profile loads.
  - If this proves too involved, an acceptable simpler fallback: keep `region="US"` and note region-personalization as deferred. Prefer the client-island approach but don't over-engineer; report what you did.

- [ ] **Step 2: RegionSelect** — `src/components/catalog/RegionSelect.tsx` (client; a `Select` of a small region list e.g. US/GB/CA/AU/NG/IN with the current value from `GET /api/v1/me/profile`; on change `PATCH /api/v1/me/profile {region}` and toast). Render it on the `/watchlist` page (signed-in branch) as a small "Your region" control, and/or near where-to-watch. Keep scope tight.

- [ ] **Step 3: e2e** — `e2e/user-data.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("watchlist page prompts anonymous users to sign in", async ({ page }) => {
  await page.goto("/watchlist");
  await expect(page.getByText(/sign in/i)).toBeVisible({ timeout: 10000 });
});

test("title page shows sign-in-to-track for anonymous users", async ({ page }) => {
  await page.goto("/title/movie/603-the-matrix");
  await expect(page.getByText(/sign in to/i).first()).toBeVisible({ timeout: 15000 });
});

test("movies browse renders with a filter bar", async ({ page }) => {
  await page.goto("/movies");
  await expect(page.getByRole("heading", { name: /movies/i })).toBeVisible({ timeout: 15000 });
});
```

(Anonymous-path assertions are deterministic; signed-in watchlist/rating flows need Clerk tokens — manual for now, documented.)

- [ ] **Step 4: Full gates** — clean `.next`, then `npm run build` (succeeds; title page still PPR ◐; me/* + browse + watchlist dynamic), `npm run test` (all green), `npm run test:e2e` (8 + 3 = 11; note TMDB-network flakiness, retry once), `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build-storybook` succeeds.

- [ ] **Step 5: Tracking** — `task-list.md`: replace the Plan 3b "not yet planned" line with a checked T1–T7 list under `## Plan 3b: Watchlists, ratings, browse (docs/.../2026-06-13-plan3b-user-data.md)`. `handoff.md`: dated entry — Plan 3b complete (watchlist/ratings schema + services, authed me/* API, StarRating, TitleActions island, /watchlist, browse /movies+/tv with filters, region wiring). Note rating scale = 5 whole stars (1–5), the client-island approach for per-user title-state on the PPR detail page, and that signed-in flows are manually verified pending Clerk testing tokens. **Plan 3 (3a+3b) DONE → catalog MVP complete.** Next: Phase 2 (community: reviews/lists/profiles) or Phase 3 (AI taste layer) — see spec.

- [ ] **Step 6: Final commit**

```
git add -A
git commit -m "feat: region wiring and e2e; close out Plan 3b"
```

---

## Plan Self-Review (completed)

- **Spec coverage (sections 4 user tables + 5 me/* API + 6 browse/watchlist):** watchlist_items + ratings tables ✓ (T1, FK to titles/profiles, cascade), watchlist/ratings services ✓ (T1), authed me/* API ✓ (T2: title-state, watchlist, ratings, profile/region), watchlist + rating UI on title pages ✓ (T3 StarRating + T4 TitleActions island), /watchlist page ✓ (T5), browse /movies + /tv with filters ✓ (T6 discover + FilterBar), region wired into where-to-watch + region selector ✓ (T7). Rating scale deviates to 1–5 whole stars (documented, justified).
- **Architecture integrity:** title detail page stays PPR-cacheable — user-specific state (title-state, region) lives in client islands that self-fetch, never forcing the page dynamic (T4, T7). me/* routes use connection() + getCurrentProfile (dynamic, correct). Browse/watchlist pages are dynamic (searchParams / per-user) — correct. Reuses getOrCreateTitle to resolve tmdbId→local title row before any user-data write (so any title is trackable), and the Plan 3a TitleResult/TitleCard/ProviderLogoRow/providersForRegion pieces.
- **Placeholders:** none — services/contracts/transforms/StarRating have full code + tests; islands/pages give explicit composition requirements (appropriate for RSC + client islands) with exact API shapes and auth/empty/loading states.
- **Type/seam consistency:** me.ts contracts (T2) used by routes + islands; meFetch/MeApiError (T2) used by useTitleState hooks (T4) and RegionSelect (T7); WatchStatus union consistent across schema/service/contract; getTitleState shape {status,score} returned by title-state route → consumed by useTitleState → TitleActions; discover's toBrowseResults reuses TitleResult/href shape from transform.ts so browse cards link to the same /title routes parseable by parseIdSlug. Region default "US" (Plan 3a) now overridable per profile.
