# Taste Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen "Build your taste profile" onboarding (pick genres → tap-to-love a quality-filtered poster grid → one batch write) that seeds a new user's taste vector and unlocks the `/for-you` feed.

**Architecture:** Selections are buffered client-side via a pure reducer, then a single `POST /api/v1/me/onboarding` writes them as ratings (love = 5, not-for-me = 1) + `preferred_genres`, embeds the titles, and recomputes the taste vector once. The modal is a client component; candidate titles come from TMDB discover (by genre, quality-filtered) through cached public routes.

**Tech Stack:** Next.js 16 App Router, Drizzle + Neon (pgvector), React Query, Clerk, Zod, Tailwind v4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-14-taste-onboarding-design.md`
**Depends on:** Phase 3a taste foundation (already merged): `recomputeTaste` (`@/services/taste`), `embedTitle`/`defaultEmbedder` (`@/services/title-embeddings`, `@/lib/taste/embedder`), `getOrCreateTitle` (`@/services/catalog`).

**Conventions:** repo root `D:\work\Tar\PROJECTS\reco`, branch `taste-onboarding` (create from `main` at start: `git checkout -b taste-onboarding`). Commit after every task. TDD: observe the failing test before implementing. Service tests use the live Neon DB with `__vitest__` isolation + cleanup and a `FakeEmbedder` (never call Voyage/TMDB network — seed titles directly so `getOrCreateTitle` hits the fresh local row). Never print env values. Never touch `D:\wamp64\www\rizmos`.

---

### Task 1: profiles.preferred_genres column

**Files:**
- Modify: `src/db/schema.ts` (profiles table)
- Create: `scripts/add-preferred-genres.mjs`

- [ ] **Step 1: Add the column to the schema** — in `src/db/schema.ts`, add to the `profiles` table definition (after `region`):

```ts
  preferredGenres: integer("preferred_genres").array(),
```
(`integer` is already imported.)

- [ ] **Step 2: Migration script** — create `scripts/add-preferred-genres.mjs` (additive, idempotent; matches the prior direct-DDL pattern):

```js
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_genres integer[]`;
console.log("preferred_genres ready");
```

- [ ] **Step 3: Run it**

Run: `node scripts/add-preferred-genres.mjs`
Expected: prints `preferred_genres ready`.

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add src/db/schema.ts scripts/add-preferred-genres.mjs
git commit -m "feat: profiles.preferred_genres column"
```

---

### Task 2: Onboarding input contract (Zod)

**Files:**
- Create: `src/lib/contracts/onboarding.ts`, `src/lib/contracts/onboarding.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/contracts/onboarding.test.ts`:

```ts
import { onboardingInput } from "./onboarding";

test("accepts a valid payload", () => {
  const parsed = onboardingInput.parse({
    genres: [28, 878],
    likes: [{ mediaType: "movie", tmdbId: 603 }],
    dislikes: [{ mediaType: "tv", tmdbId: 1396 }],
  });
  expect(parsed.likes).toHaveLength(1);
});

test("rejects bad mediaType and oversize arrays", () => {
  expect(() => onboardingInput.parse({ genres: [], likes: [{ mediaType: "x", tmdbId: 1 }], dislikes: [] })).toThrow();
  expect(() => onboardingInput.parse({ genres: Array(31).fill(1), likes: [], dislikes: [] })).toThrow();
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/lib/contracts/onboarding.test.ts`

- [ ] **Step 3: Implement** `src/lib/contracts/onboarding.ts`. First READ `src/lib/contracts/me.ts`; if it exports a `titleRef`/`mediaType` schema, reuse it. Otherwise define inline as below:

```ts
import { z } from "zod";

export const onboardingTitleRef = z.object({
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number().int().positive(),
});
export type OnboardingTitleRef = z.infer<typeof onboardingTitleRef>;

export const onboardingInput = z.object({
  genres: z.array(z.number().int()).max(30),
  likes: z.array(onboardingTitleRef).max(80),
  dislikes: z.array(onboardingTitleRef).max(40),
});
export type OnboardingInput = z.infer<typeof onboardingInput>;
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/lib/contracts/onboarding.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/onboarding.ts src/lib/contracts/onboarding.test.ts
git commit -m "feat: onboarding input contract"
```

---

### Task 3: Pick blending (pure)

**Files:**
- Create: `src/lib/onboarding/picks.ts`, `src/lib/onboarding/picks.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/onboarding/picks.test.ts`:

```ts
import { blendPicks } from "./picks";
import type { TmdbSearchItem } from "@/lib/tmdb/types";

const movie = (id: number, title: string): TmdbSearchItem => ({ id, media_type: "movie", title, release_date: "2016-01-01", poster_path: "/p.jpg" });
const tv = (id: number, name: string): TmdbSearchItem => ({ id, media_type: "tv", name, first_air_date: "2018-01-01", poster_path: "/q.jpg" });

test("blendPicks interleaves movie/tv, dedupes, drops excluded", () => {
  const out = blendPicks([movie(1, "A"), movie(2, "B")], [tv(3, "C")], { exclude: new Set(["movie:2"]) });
  expect(out.map((p) => `${p.mediaType}:${p.tmdbId}`)).toEqual(["movie:1", "tv:3"]);
  expect(out[0]).toMatchObject({ title: "A", year: 2016, mediaType: "movie" });
  expect(out[0].posterUrl).toContain("/p.jpg");
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/lib/onboarding/picks.test.ts`

- [ ] **Step 3: Implement** `src/lib/onboarding/picks.ts`:

```ts
import type { TmdbSearchItem } from "@/lib/tmdb/types";
import { posterUrl } from "@/lib/tmdb/images";

export interface PickCard {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
}

const key = (m: "movie" | "tv", id: number) => `${m}:${id}`;

/** Interleave movie + tv discover results into pick cards; dedupe and drop excluded/posterless. */
export function blendPicks(
  movies: TmdbSearchItem[],
  tv: TmdbSearchItem[],
  opts: { exclude?: Set<string> } = {},
): PickCard[] {
  const exclude = opts.exclude ?? new Set<string>();
  const seen = new Set<string>();
  const out: PickCard[] = [];
  const max = Math.max(movies.length, tv.length);
  for (let i = 0; i < max; i++) {
    for (const [item, mt] of [
      [movies[i], "movie"] as const,
      [tv[i], "tv"] as const,
    ]) {
      if (!item || !item.poster_path) continue;
      const k = key(mt, item.id);
      if (seen.has(k) || exclude.has(k)) continue;
      seen.add(k);
      const name = item.title ?? item.name ?? "Untitled";
      const date = item.release_date ?? item.first_air_date ?? "";
      const year = date.length >= 4 ? Number(date.slice(0, 4)) : null;
      out.push({
        tmdbId: item.id,
        mediaType: mt,
        title: name,
        year: Number.isFinite(year) ? year : null,
        posterUrl: posterUrl(item.poster_path),
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/lib/onboarding/picks.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding/picks.ts src/lib/onboarding/picks.test.ts
git commit -m "feat: onboarding pick blending"
```

---

### Task 4: Onboarding selection reducer (pure)

**Files:**
- Create: `src/components/onboarding/state.ts`, `src/components/onboarding/state.test.ts`

- [ ] **Step 1: Failing test** — `src/components/onboarding/state.test.ts`:

```ts
import { onboardingReducer, initialState, canProceed, MIN_GENRES, MIN_LIKES } from "./state";

test("toggles genres and gates step 1 on MIN_GENRES", () => {
  let s = initialState();
  expect(canProceed(s)).toBe(false);
  for (const g of [1, 2, 3]) s = onboardingReducer(s, { type: "toggleGenre", id: g });
  expect(s.genres.size).toBe(MIN_GENRES);
  expect(canProceed(s)).toBe(true);
  s = onboardingReducer(s, { type: "toggleGenre", id: 1 });
  expect(s.genres.has(1)).toBe(false);
});

test("like and dislike are mutually exclusive; titles step gates on MIN_LIKES", () => {
  let s = { ...initialState(), step: "titles" as const };
  s = onboardingReducer(s, { type: "toggleLike", key: "movie:1" });
  s = onboardingReducer(s, { type: "toggleDislike", key: "movie:1" });
  expect(s.likes.has("movie:1")).toBe(false);
  expect(s.dislikes.has("movie:1")).toBe(true);
  expect(canProceed(s)).toBe(false);
  for (let i = 0; i < MIN_LIKES; i++) s = onboardingReducer(s, { type: "toggleLike", key: `movie:${100 + i}` });
  expect(canProceed(s)).toBe(true);
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/components/onboarding/state.test.ts`

- [ ] **Step 3: Implement** `src/components/onboarding/state.ts`:

```ts
export const MIN_GENRES = 3;
export const MIN_LIKES = 10;

export type OnboardingStep = "genres" | "titles" | "finishing";

export interface OnboardingState {
  step: OnboardingStep;
  genres: Set<number>;
  likes: Set<string>;
  dislikes: Set<string>;
}

export type OnboardingAction =
  | { type: "toggleGenre"; id: number }
  | { type: "toggleLike"; key: string }
  | { type: "toggleDislike"; key: string }
  | { type: "setStep"; step: OnboardingStep };

export function initialState(): OnboardingState {
  return { step: "genres", genres: new Set(), likes: new Set(), dislikes: new Set() };
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "toggleGenre":
      return { ...state, genres: toggle(state.genres, action.id) };
    case "toggleLike": {
      const dislikes = new Set(state.dislikes);
      dislikes.delete(action.key);
      return { ...state, likes: toggle(state.likes, action.key), dislikes };
    }
    case "toggleDislike": {
      const likes = new Set(state.likes);
      likes.delete(action.key);
      return { ...state, dislikes: toggle(state.dislikes, action.key), likes };
    }
    case "setStep":
      return { ...state, step: action.step };
  }
}

export function canProceed(state: OnboardingState): boolean {
  if (state.step === "genres") return state.genres.size >= MIN_GENRES;
  if (state.step === "titles") return state.likes.size >= MIN_LIKES;
  return false;
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/components/onboarding/state.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/state.ts src/components/onboarding/state.test.ts
git commit -m "feat: onboarding selection reducer"
```

---

### Task 5: Onboarding submit service

**Files:**
- Create: `src/services/onboarding.ts`, `src/services/onboarding.test.ts`

- [ ] **Step 1: Failing test** — `src/services/onboarding.test.ts` (seed a profile + two titles directly so `getOrCreateTitle` hits the fresh local rows — no TMDB network):

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, titles, ratings, userTaste } from "@/db/schema";
import { submitOnboarding } from "./onboarding";
import { FakeEmbedder } from "@/lib/taste/embedder";

const TMDB_A = 999100001, TMDB_B = 999100002;
let userId: string;

beforeAll(async () => {
  const [p] = await db.insert(profiles).values({ clerkUserId: "__vitest__onb", username: "__vitest__onb" }).returning();
  userId = p.id;
  for (const tmdb of [TMDB_A, TMDB_B]) {
    await db.insert(titles).values({
      tmdbId: tmdb, mediaType: "movie", slug: `__vitest__${tmdb}`, title: `T${tmdb}`,
      metadata: { id: tmdb, genres: [{ id: 1, name: "Drama" }] }, refreshedAt: new Date(),
    });
  }
});
afterAll(async () => {
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_A));
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_B));
  await db.delete(profiles).where(eq(profiles.id, userId));
});

test("submitOnboarding writes ratings, saves genres, builds taste", async () => {
  const res = await submitOnboarding(
    userId,
    { genres: [1, 2, 3], likes: [{ mediaType: "movie", tmdbId: TMDB_A }], dislikes: [{ mediaType: "movie", tmdbId: TMDB_B }] },
    new FakeEmbedder(),
  );
  expect(res.ratedCount).toBe(2);
  const rows = await db.select().from(ratings).where(eq(ratings.userId, userId));
  expect(rows.find((r) => r.score === 5)).toBeTruthy();
  expect(rows.find((r) => r.score === 1)).toBeTruthy();
  const [prof] = await db.select().from(profiles).where(eq(profiles.id, userId));
  expect(prof.preferredGenres).toEqual([1, 2, 3]);
  const [taste] = await db.select().from(userTaste).where(eq(userTaste.userId, userId));
  expect(taste.embedding).toHaveLength(1024);
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/services/onboarding.test.ts`

- [ ] **Step 3: Implement** `src/services/onboarding.ts`:

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, ratings } from "@/db/schema";
import { getOrCreateTitle } from "@/services/catalog";
import { embedTitle } from "@/services/title-embeddings";
import { recomputeTaste } from "@/services/taste";
import type { Embedder } from "@/lib/taste/embedder";
import type { OnboardingInput } from "@/lib/contracts/onboarding";

/** Persist onboarding selections as ratings (+ preferred genres), embed the titles,
 *  and recompute the taste vector once. Best-effort per title. */
export async function submitOnboarding(
  userId: string,
  input: OnboardingInput,
  embedder: Embedder,
): Promise<{ ratedCount: number }> {
  await db.update(profiles).set({ preferredGenres: input.genres }).where(eq(profiles.id, userId));

  const signals: { ref: OnboardingInput["likes"][number]; score: number }[] = [
    ...input.likes.map((ref) => ({ ref, score: 5 })),
    ...input.dislikes.map((ref) => ({ ref, score: 1 })),
  ];

  let ratedCount = 0;
  for (const { ref, score } of signals) {
    try {
      const title = await getOrCreateTitle(ref.mediaType, ref.tmdbId);
      await embedTitle(title.id, embedder);
      await db
        .insert(ratings)
        .values({ userId, titleId: title.id, score })
        .onConflictDoUpdate({ target: [ratings.userId, ratings.titleId], set: { score, ratedAt: new Date() } });
      ratedCount++;
    } catch {
      // best-effort: a single TMDB/embedding failure skips that title
    }
  }

  await recomputeTaste(userId);
  return { ratedCount };
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/services/onboarding.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/services/onboarding.ts src/services/onboarding.test.ts
git commit -m "feat: onboarding submit service"
```

---

### Task 6: Public routes — genres + picks

**Files:**
- Create: `src/app/api/v1/onboarding/genres/route.ts`, `src/app/api/v1/onboarding/picks/route.ts`

- [ ] **Step 1: Implement genres route** — `src/app/api/v1/onboarding/genres/route.ts`:

```ts
import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";

async function combinedGenres() {
  "use cache";
  const [movie, tv] = await Promise.all([tmdb.genres("movie"), tmdb.genres("tv")]);
  const byId = new Map<number, string>();
  for (const g of [...movie.genres, ...tv.genres]) byId.set(g.id, g.name);
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
  try {
    return NextResponse.json({ genres: await combinedGenres() });
  } catch {
    return NextResponse.json({ genres: [] });
  }
}
```

- [ ] **Step 2: Implement picks route** — `src/app/api/v1/onboarding/picks/route.ts`:

```ts
import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { blendPicks } from "@/lib/onboarding/picks";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const genres = (url.searchParams.get("genres") ?? "").split(",").filter(Boolean).slice(0, 10).join(",");
  const page = String(Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1));
  if (!genres) return NextResponse.json({ picks: [] });

  const params = { with_genres: genres, sort_by: "popularity.desc", "vote_count.gte": "300", page };
  try {
    const [movie, tv] = await Promise.all([tmdb.discover("movie", params), tmdb.discover("tv", params)]);
    return NextResponse.json({ picks: blendPicks(movie.results, tv.results) });
  } catch {
    return NextResponse.json({ picks: [] });
  }
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm run lint`. Manually: `curl "localhost:3000/api/v1/onboarding/genres"` returns a genre list; `curl "localhost:3000/api/v1/onboarding/picks?genres=28,878"` returns picks.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/onboarding/genres/route.ts src/app/api/v1/onboarding/picks/route.ts
git commit -m "feat: onboarding genres + picks routes"
```

---

### Task 7: Authed route — POST /me/onboarding

**Files:**
- Create: `src/app/api/v1/me/onboarding/route.ts`

- [ ] **Step 1: Implement** — `src/app/api/v1/me/onboarding/route.ts` (READ `src/app/api/v1/me/ratings/route.ts` first for the auth + jsonError pattern):

```ts
import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { submitOnboarding } from "@/services/onboarding";
import { onboardingInput } from "@/lib/contracts/onboarding";
import { defaultEmbedder } from "@/lib/taste/embedder";
import { jsonError } from "@/lib/api";

export const maxDuration = 60;

export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }
    const input = onboardingInput.parse(body);
    const result = await submitOnboarding(profile.id, input, defaultEmbedder());
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    console.error(err);
    return jsonError(500, "Onboarding failed");
  }
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint`. `curl -X POST localhost:3000/api/v1/me/onboarding` signed out → 401.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/me/onboarding/route.ts
git commit -m "feat: POST /me/onboarding route"
```

---

### Task 8: Onboarding step UI (poster, genre step, title step)

**Files:**
- Create: `src/components/onboarding/OnboardingPoster.tsx`, `src/components/onboarding/OnboardingGenreStep.tsx`, `src/components/onboarding/OnboardingTitleStep.tsx`

- [ ] **Step 1: Selectable poster** — `src/components/onboarding/OnboardingPoster.tsx`:

```tsx
"use client";
import { cn } from "@/lib/cn";

export function OnboardingPoster({
  title, year, posterUrl, selected, onClick,
}: {
  title: string; year: number | null; posterUrl: string | null; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative block w-full overflow-hidden rounded-lg border text-left transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected ? "border-accent ring-2 ring-accent/40" : "border-border hover:border-text-muted",
      )}
    >
      <div className="aspect-2/3 w-full bg-surface-overlay">
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      {selected && (
        <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-xs text-white">✓</span>
      )}
      <span className="block truncate px-1.5 py-1 text-xs text-text">{title}{year ? ` (${year})` : ""}</span>
    </button>
  );
}
```

- [ ] **Step 2: Genre step** — `src/components/onboarding/OnboardingGenreStep.tsx`:

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";

interface Genre { id: number; name: string }

export function OnboardingGenreStep({ selected, onToggle }: { selected: Set<number>; onToggle: (id: number) => void }) {
  const { data } = useQuery({
    queryKey: ["onboarding-genres"],
    queryFn: () => fetch("/api/v1/onboarding/genres").then((r) => r.json() as Promise<{ genres: Genre[] }>),
    staleTime: 60 * 60 * 1000,
  });
  const genres = data?.genres ?? [];
  return (
    <div className="flex flex-wrap gap-2.5">
      {genres.map((g) => {
        const on = selected.has(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onToggle(g.id)}
            aria-pressed={on}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              on ? "border-accent bg-accent text-white" : "border-border bg-surface-raised text-text hover:border-text-muted",
            )}
          >
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Title step** — `src/components/onboarding/OnboardingTitleStep.tsx` (picks grid; search via the existing `/api/v1/search`; 2-col mobile → 5-col desktop):

```tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OnboardingPoster } from "./OnboardingPoster";
import type { PickCard } from "@/lib/onboarding/picks";

const titleKey = (mt: string, id: number) => `${mt}:${id}`;

export function OnboardingTitleStep({
  genres, likes, onToggleLike,
}: {
  genres: number[]; likes: Set<string>; onToggleLike: (key: string, card: PickCard) => void;
}) {
  const [q, setQ] = useState("");
  const picksQuery = useQuery({
    queryKey: ["onboarding-picks", genres.join(",")],
    queryFn: () =>
      fetch(`/api/v1/onboarding/picks?genres=${genres.join(",")}`).then((r) => r.json() as Promise<{ picks: PickCard[] }>),
    enabled: genres.length > 0,
  });
  const searchQuery = useQuery({
    queryKey: ["onboarding-search", q],
    enabled: q.trim().length > 1,
    queryFn: () =>
      fetch(`/api/v1/search?q=${encodeURIComponent(q.trim())}`).then((r) => r.json() as Promise<{ results?: { kind: string; tmdbId: number; mediaType?: "movie" | "tv"; title?: string; year?: number | null; posterUrl?: string | null }[] }>),
  });

  const cards: PickCard[] =
    q.trim().length > 1
      ? (searchQuery.data?.results ?? [])
          .filter((r) => r.kind === "title" && r.mediaType)
          .map((r) => ({ tmdbId: r.tmdbId, mediaType: r.mediaType as "movie" | "tv", title: r.title ?? "Untitled", year: r.year ?? null, posterUrl: r.posterUrl ?? null }))
      : (picksQuery.data?.picks ?? []);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a specific favorite…"
        aria-label="Search titles"
        className="mb-4 h-10 w-full max-w-sm rounded-md border border-border bg-surface-raised px-3 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {cards.map((card) => {
          const key = titleKey(card.mediaType, card.tmdbId);
          return (
            <OnboardingPoster
              key={key}
              title={card.title}
              year={card.year}
              posterUrl={card.posterUrl}
              selected={likes.has(key)}
              onClick={() => onToggleLike(key, card)}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npm run lint`. (READ `src/lib/me-client.ts` and an existing island to confirm patterns; verify `/api/v1/search` response shape and adjust the mapping in this file to the actual fields if they differ.)

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/OnboardingPoster.tsx src/components/onboarding/OnboardingGenreStep.tsx src/components/onboarding/OnboardingTitleStep.tsx
git commit -m "feat: onboarding step UI (poster, genres, titles)"
```

---

### Task 9: Onboarding modal shell + finishing

**Files:**
- Create: `src/components/onboarding/TasteOnboarding.tsx`

- [ ] **Step 1: Implement the modal** — `src/components/onboarding/TasteOnboarding.tsx` (full-screen overlay; uses the reducer from Task 4; buffers picks so it can submit refs; a11y: role=dialog, aria-modal, Esc to close, body scroll lock):

```tsx
"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import { onboardingReducer, initialState, canProceed, MIN_GENRES, MIN_LIKES } from "./state";
import { OnboardingGenreStep } from "./OnboardingGenreStep";
import { OnboardingTitleStep } from "./OnboardingTitleStep";
import type { PickCard } from "@/lib/onboarding/picks";

export function TasteOnboarding({ onClose }: { onClose: () => void }) {
  const [state, dispatch] = useReducer(onboardingReducer, undefined, initialState);
  const [cardsByKey] = useState(() => new Map<string, PickCard>());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  function toggleLike(key: string, card: PickCard) {
    cardsByKey.set(key, card);
    dispatch({ type: "toggleLike", key });
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    dispatch({ type: "setStep", step: "finishing" });
    const refs = (keys: Set<string>) =>
      [...keys].map((k) => { const c = cardsByKey.get(k); return c ? { mediaType: c.mediaType, tmdbId: c.tmdbId } : null; }).filter(Boolean);
    try {
      await meFetch("/api/v1/me/onboarding", {
        method: "POST",
        body: { genres: [...state.genres], likes: refs(state.likes), dislikes: refs(state.dislikes) },
      });
      await qc.invalidateQueries({ queryKey: ["for-you"] });
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
      dispatch({ type: "setStep", step: "titles" });
      setSubmitting(false);
    }
  }

  const stepIndex = state.step === "genres" ? 1 : 2;
  const proceedLabel = state.step === "genres" ? "Continue" : "Finish";
  const counter =
    state.step === "genres"
      ? `${state.genres.size} selected${state.genres.size < MIN_GENRES ? ` — pick ${MIN_GENRES - state.genres.size} more` : ""}`
      : `${state.likes.size} selected${state.likes.size < MIN_LIKES ? ` — pick ${MIN_LIKES - state.likes.size} more` : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface" role="dialog" aria-modal="true" aria-label="Build your taste profile" ref={dialogRef} tabIndex={-1}>
      <header className="flex items-center gap-4 border-b border-border px-5 py-4">
        <span className="text-lg font-bold text-text">reco</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-overlay">
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${stepIndex === 1 ? 30 : 65}%` }} />
          </div>
          <span className="whitespace-nowrap text-xs text-text-muted">Step {stepIndex} of 2</span>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text">Skip for now</button>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-5 py-6">
        {state.step === "genres" && (
          <>
            <h1 className="text-2xl font-bold text-text">What do you love to watch?</h1>
            <p className="mb-5 mt-1 text-sm text-text-muted">Pick at least {MIN_GENRES} genres to get started.</p>
            <OnboardingGenreStep selected={state.genres} onToggle={(id) => dispatch({ type: "toggleGenre", id })} />
          </>
        )}
        {state.step === "titles" && (
          <>
            <h1 className="text-2xl font-bold text-text">Tap the ones you love</h1>
            <p className="mb-5 mt-1 text-sm text-text-muted">The more you tap, the sharper your matches.</p>
            <OnboardingTitleStep genres={[...state.genres]} likes={state.likes} onToggleLike={toggleLike} />
          </>
        )}
        {state.step === "finishing" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="size-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-lg font-medium text-text">Building your taste profile…</p>
          </div>
        )}
      </div>

      {state.step !== "finishing" && (
        <footer className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
          <div aria-live="polite" className="text-sm">
            <span className="font-medium text-success">{counter}</span>
          </div>
          <div className="flex items-center gap-2">
            {state.step === "titles" && (
              <button type="button" onClick={() => dispatch({ type: "setStep", step: "genres" })} className="rounded-md border border-border bg-surface-raised px-4 py-2 text-sm text-text hover:bg-surface-overlay">Back</button>
            )}
            <button
              type="button"
              disabled={!canProceed(state) || submitting}
              onClick={() => (state.step === "genres" ? dispatch({ type: "setStep", step: "titles" }) : finish())}
              className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-overlay disabled:text-text-muted"
            >
              {proceedLabel}
            </button>
          </div>
          {error && <p className="sr-only">{error}</p>}
        </footer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint`. Confirm `meFetch`'s signature (`@/lib/me-client`) matches the `{ method, body }` usage; adjust if the existing helper differs.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/TasteOnboarding.tsx
git commit -m "feat: taste onboarding modal shell"
```

---

### Task 10: For-you integration (trigger + signed-out CTA)

**Files:**
- Modify: `src/app/for-you/ForYouGrid.tsx`

- [ ] **Step 1: Wire the trigger** — update `src/app/for-you/ForYouGrid.tsx` so the cold-start state shows a "Build your taste profile" button (signed in) or a sign-in CTA (signed out), and opens `TasteOnboarding`. READ the current file first; preserve the existing loading/empty/grid logic. Add at top:

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { TasteOnboarding } from "@/components/onboarding/TasteOnboarding";
```

**Rules of hooks:** declare `const { isSignedIn } = useAuth();` and `const [onboarding, setOnboarding] = useState(false);` at the TOP of the `ForYouGrid` component body (alongside the existing `useQuery`), NOT inside any conditional branch. Then, in the `needsMoreRatings` / no-data branch, replace the bare `<EmptyState .../>` return with:

```tsx
  return (
    <>
      <EmptyState
        title="Discover what to watch next"
        description={`Build your taste profile and we'll surface movies and shows matched to you.`}
        action={
          isSignedIn === false ? (
            <Link href="/sign-in" className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-text hover:bg-accent-hover">
              Sign in to get started
            </Link>
          ) : (
            <button type="button" onClick={() => setOnboarding(true)} className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-text hover:bg-accent-hover">
              Build your taste profile
            </button>
          )
        }
      />
      {onboarding && <TasteOnboarding onClose={() => setOnboarding(false)} />}
    </>
  );
```

Keep the loading state and the populated-grid branch unchanged. (Verify `EmptyState`'s `action` prop exists by reading `src/components/ui/EmptyState.tsx`; it does — used on the watchlist page.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npm run lint && npm run build`. Confirm `/for-you` still builds.

- [ ] **Step 3: Commit**

```bash
git add src/app/for-you/ForYouGrid.tsx
git commit -m "feat: launch onboarding from the For-you cold start"
```

---

### Task 11: Full verification

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npm run lint` → clean.
- [ ] **Step 3:** `npm test` → all green (new contract/picks/reducer/onboarding-service tests pass with FakeEmbedder).
- [ ] **Step 4:** `npm run build` → compiles; `/api/v1/onboarding/genres`, `/api/v1/onboarding/picks`, `/api/v1/me/onboarding` routes present.
- [ ] **Step 5:** Manual smoke (dev, signed in, FakeEmbedder): open `/for-you` → "Build your taste profile" → pick 3 genres → Continue → tap 10 posters → Finish → modal closes and the feed renders. Signed out: the cold start shows "Sign in to get started".
- [ ] **Step 6:** Commit any fixups. Branch ready to merge to `main`. (Real picks/embeddings in production still require `VOYAGE_API_KEY`; the flow itself works without it, just with placeholder match quality.)
