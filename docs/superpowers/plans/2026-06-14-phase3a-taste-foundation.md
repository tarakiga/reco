# Phase 3a: Taste Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed titles (pgvector + Voyage), derive a per-user taste vector from ratings/watchlist, and surface a % match on title detail pages plus a "For you" feed.

**Architecture:** Content-based: each title's metadata is synthesized into a descriptor and embedded into a `vector(1024)`; a user's taste vector is the weighted centroid of their rated/watchlisted titles' embeddings; match = cosine similarity. Embedding is async/optional (never blocks a page); a Vercel Cron + per-user "similar" expansion keep a candidate pool warm for the feed. All embedding calls go through an injected `Embedder` interface so tests use a deterministic fake (no network/cost).

**Tech Stack:** Drizzle + Neon (pgvector), Voyage `voyage-3.5`, Next.js 16 route handlers + `after()`, Vercel Cron, Zod, React Query, existing catalog components.

**Spec:** `docs/superpowers/specs/2026-06-14-phase3a-taste-foundation-design.md`

**Conventions:** repo root `D:\work\Tar\PROJECTS\reco`, branch `phase-3a-taste` (create from `main` at start: `git checkout -b phase-3a-taste`). Commit after every task. TDD: write the failing test and observe it fail before implementing. Service tests run against the live Neon DB using throwaway `__vitest__*` namespaces with cleanup, and a `FakeEmbedder` (never call Voyage in tests). Never print env values. Never touch `D:\wamp64\www\rizmos`.

---

### Task 1: pgvector + embeddings/taste schema

**Files:**
- Create: `src/db/vector.ts`
- Modify: `src/db/schema.ts` (append)
- Create: `scripts/enable-pgvector.mjs`
- Modify: `package.json` (script), `.env.example` (document new vars)

- [ ] **Step 1: Drizzle vector column type** — create `src/db/vector.ts`:

```ts
import { customType } from "drizzle-orm/pg-core";

/** pgvector column. Stores number[] in JS, `[a,b,c]` text on the wire. */
export const vector = (dim: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dim})`;
    },
    toDriver(value: number[]) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string) {
      return value.slice(1, -1).split(",").map(Number);
    },
  });

/** Postgres vector literal for raw SQL (e.g. ANN ordering). */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

export const EMBEDDING_DIM = 1024;
```

- [ ] **Step 2: Append tables** to `src/db/schema.ts` (add `import { vector, EMBEDDING_DIM } from "./vector";` at top):

```ts
const vec = vector(EMBEDDING_DIM);

export const titleEmbeddings = pgTable("title_embeddings", {
  titleId: uuid("title_id")
    .primaryKey()
    .references(() => titles.id, { onDelete: "cascade" }),
  embedding: vec("embedding").notNull(),
  model: text("model").notNull(),
  descriptorHash: text("descriptor_hash").notNull(),
  builtAt: timestamp("built_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userTaste = pgTable("user_taste", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  embedding: vec("embedding").notNull(),
  ratedCount: integer("rated_count").notNull().default(0),
  builtAt: timestamp("built_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TitleEmbeddingRow = typeof titleEmbeddings.$inferSelect;
export type UserTasteRow = typeof userTaste.$inferSelect;
```

- [ ] **Step 3: Extension + index script** — create `scripts/enable-pgvector.mjs` (drizzle-kit can't emit the extension or an HNSW index; apply directly, matching the Plan 3a/3b direct-DDL pattern):

```js
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`CREATE EXTENSION IF NOT EXISTS vector`;
await sql`
  CREATE TABLE IF NOT EXISTS title_embeddings (
    title_id uuid PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
    embedding vector(1024) NOT NULL,
    model text NOT NULL,
    descriptor_hash text NOT NULL,
    built_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`
  CREATE TABLE IF NOT EXISTS user_taste (
    user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    embedding vector(1024) NOT NULL,
    rated_count integer NOT NULL DEFAULT 0,
    built_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`
  CREATE INDEX IF NOT EXISTS title_embeddings_hnsw
  ON title_embeddings USING hnsw (embedding vector_cosine_ops)`;
console.log("pgvector ready");
```

Add to `package.json` scripts: `"db:pgvector": "node scripts/enable-pgvector.mjs"`. Document `VOYAGE_API_KEY=` and `CRON_SECRET=` in `.env.example`.

- [ ] **Step 4: Run it**

Run: `npm run db:pgvector`
Expected: prints `pgvector ready`, no error.

- [ ] **Step 5: Verify the DB** — introspect that `title_embeddings`/`user_taste` exist with `vector` columns and the HNSW index. Run a one-off:
`node -e "import('dotenv/config').then(async()=>{const {neon}=await import('@neondatabase/serverless');const sql=neon(process.env.DATABASE_URL);console.log(await sql\`SELECT indexname FROM pg_indexes WHERE tablename='title_embeddings'\`)})"`
Expected: includes `title_embeddings_hnsw`.

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
```bash
git add src/db/vector.ts src/db/schema.ts scripts/enable-pgvector.mjs package.json .env.example
git commit -m "feat: pgvector + title_embeddings/user_taste schema"
```

---

### Task 2: Embedder interface (Voyage + fake)

**Files:**
- Create: `src/lib/taste/embedder.ts`, `src/lib/taste/embedder.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/taste/embedder.test.ts`:

```ts
import { FakeEmbedder } from "./embedder";

test("FakeEmbedder returns deterministic unit-length vectors of the right dim", async () => {
  const e = new FakeEmbedder(8);
  const [a1] = await e.embed(["alien horror"], "document");
  const [a2] = await e.embed(["alien horror"], "document");
  const [b] = await e.embed(["romcomedy"], "document");
  expect(a1).toHaveLength(8);
  expect(a1).toEqual(a2); // deterministic
  expect(a1).not.toEqual(b); // content-sensitive
  const norm = Math.hypot(...a1);
  expect(norm).toBeCloseTo(1, 5); // unit length
});

test("FakeEmbedder embeds many in order", async () => {
  const e = new FakeEmbedder(8);
  const out = await e.embed(["a", "b", "c"], "document");
  expect(out).toHaveLength(3);
});
```

- [ ] **Step 2: Run — expect fail** (`FakeEmbedder` undefined).
Run: `npx vitest run src/lib/taste/embedder.test.ts`

- [ ] **Step 3: Implement** `src/lib/taste/embedder.ts`:

```ts
import "server-only";
import { EMBEDDING_DIM } from "@/db/vector";

export type EmbedInputType = "document" | "query";

export interface Embedder {
  readonly model: string;
  embed(texts: string[], inputType: EmbedInputType): Promise<number[][]>;
}

/** Deterministic, network-free embedder for tests/local dev. */
export class FakeEmbedder implements Embedder {
  readonly model = "fake";
  constructor(private dim: number = EMBEDDING_DIM) {}
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => unit(seedVector(t, this.dim)));
  }
}

function seedVector(text: string, dim: number): number[] {
  // Simple deterministic hash → pseudo-random components.
  const v = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    v[(c + i) % dim] += ((c * 31 + i) % 17) - 8;
  }
  // Ensure non-zero.
  v[0] += 1;
  return v;
}

function unit(v: number[]): number[] {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

/** Voyage AI embeddings (voyage-3.5, 1024-d). Used in production. */
export class VoyageEmbedder implements Embedder {
  readonly model = "voyage-3.5";
  constructor(private apiKey = process.env.VOYAGE_API_KEY) {}
  async embed(texts: string[], inputType: EmbedInputType): Promise<number[][]> {
    if (!this.apiKey) throw new Error("VOYAGE_API_KEY is not configured");
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        input_type: inputType,
        output_dimension: EMBEDDING_DIM,
      }),
    });
    if (!res.ok) throw new Error(`Voyage embed failed (${res.status})`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}

/** Default embedder: Voyage in prod, fake when no key (local/test). */
export function defaultEmbedder(): Embedder {
  return process.env.VOYAGE_API_KEY ? new VoyageEmbedder() : new FakeEmbedder();
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/lib/taste/embedder.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/taste/embedder.ts src/lib/taste/embedder.test.ts
git commit -m "feat: Embedder interface (Voyage + deterministic fake)"
```

---

### Task 3: Title taste descriptor + TMDB keywords

**Files:**
- Modify: `src/lib/tmdb/types.ts` (add `keywords`), `src/lib/tmdb/client.ts` (append `keywords` to `getTitle`)
- Create: `src/lib/taste/descriptor.ts`, `src/lib/taste/descriptor.test.ts`

- [ ] **Step 1: Add keywords to types** — in `src/lib/tmdb/types.ts`, add to `TmdbTitleDetail`:

```ts
  keywords?: { keywords?: { id: number; name: string }[]; results?: { id: number; name: string }[] };
```
(Movies use `keywords.keywords`, TV uses `keywords.results`.)

- [ ] **Step 2: Request keywords** — in `src/lib/tmdb/client.ts` `getTitle`, add `"keywords"` to the `append_to_response` array.

- [ ] **Step 3: Failing test** — `src/lib/taste/descriptor.test.ts`:

```ts
import { buildTasteDescriptor, descriptorHash } from "./descriptor";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

const meta: TmdbTitleDetail = {
  id: 1,
  title: "Arrival",
  release_date: "2016-11-11",
  original_language: "en",
  genres: [{ id: 18, name: "Drama" }, { id: 878, name: "Science Fiction" }],
  keywords: { keywords: [{ id: 1, name: "linguistics" }, { id: 2, name: "aliens" }] },
  credits: {
    cast: [{ id: 1, name: "Amy Adams", order: 0 }, { id: 2, name: "Jeremy Renner", order: 1 }],
    crew: [{ id: 9, name: "Denis Villeneuve", job: "Director", department: "Directing" }],
  },
};

test("buildTasteDescriptor includes title, decade, genres, keywords, cast, director", () => {
  const d = buildTasteDescriptor(meta, "movie");
  expect(d).toContain("Arrival");
  expect(d).toContain("2010s");
  expect(d).toContain("Science Fiction");
  expect(d).toContain("linguistics");
  expect(d).toContain("Amy Adams");
  expect(d).toContain("Denis Villeneuve");
});

test("descriptorHash is stable and content-sensitive", () => {
  const h1 = descriptorHash(buildTasteDescriptor(meta, "movie"));
  const h2 = descriptorHash(buildTasteDescriptor(meta, "movie"));
  expect(h1).toBe(h2);
  expect(h1).not.toBe(descriptorHash("other"));
});
```

- [ ] **Step 4: Run — expect fail.** `npx vitest run src/lib/taste/descriptor.test.ts`

- [ ] **Step 5: Implement** `src/lib/taste/descriptor.ts`:

```ts
import { createHash } from "node:crypto";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import type { MediaType } from "@/lib/tmdb/detail";
import { keyCrew } from "@/lib/tmdb/detail";

export function buildTasteDescriptor(meta: TmdbTitleDetail, mediaType: MediaType): string {
  const name = meta.title ?? meta.name ?? "Untitled";
  const date = meta.release_date ?? meta.first_air_date ?? "";
  const year = date.length >= 4 ? Number(date.slice(0, 4)) : null;
  const decade = year ? `${Math.floor(year / 10) * 10}s` : "";
  const genres = (meta.genres ?? []).map((g) => g.name);
  const kwList = meta.keywords?.keywords ?? meta.keywords?.results ?? [];
  const keywords = kwList.slice(0, 12).map((k) => k.name);
  const cast = (meta.credits?.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 6)
    .map((c) => c.name);
  const crew = keyCrew(meta, mediaType).flatMap((c) => c.names);

  const parts = [
    `${mediaType === "tv" ? "TV series" : "Movie"}: ${name}`,
    decade && `Era: ${decade}`,
    genres.length && `Genres: ${genres.join(", ")}`,
    keywords.length && `Themes: ${keywords.join(", ")}`,
    crew.length && `By: ${crew.join(", ")}`,
    cast.length && `Starring: ${cast.join(", ")}`,
    meta.overview && `Synopsis: ${meta.overview}`,
  ].filter(Boolean);
  return parts.join("\n");
}

export function descriptorHash(descriptor: string): string {
  return createHash("sha256").update(descriptor).digest("hex");
}
```

- [ ] **Step 6: Run — expect pass.** `npx vitest run src/lib/taste/descriptor.test.ts`

- [ ] **Step 7: tsc + commit**

```bash
npx tsc --noEmit
git add src/lib/tmdb/types.ts src/lib/tmdb/client.ts src/lib/taste/descriptor.ts src/lib/taste/descriptor.test.ts
git commit -m "feat: title taste descriptor + TMDB keywords"
```

---

### Task 4: Taste vector math (weights + centroid)

**Files:**
- Create: `src/lib/taste/vector.ts`, `src/lib/taste/vector.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/taste/vector.test.ts`:

```ts
import { signalWeight, tasteCentroid } from "./vector";

test("signalWeight: ratings dominate, watchlist mild", () => {
  expect(signalWeight({ score: 5 })).toBe(1.0);
  expect(signalWeight({ score: 1 })).toBe(-1.0);
  expect(signalWeight({ score: 3 })).toBeCloseTo(0.1);
  expect(signalWeight({ status: "watched" })).toBe(0.3);
  expect(signalWeight({ status: "want_to_watch" })).toBe(0.15);
  // a score wins over status when both present
  expect(signalWeight({ score: 5, status: "watched" })).toBe(1.0);
});

test("tasteCentroid is the L2-normalized weighted sum", () => {
  const out = tasteCentroid([
    { weight: 1, embedding: [1, 0] },
    { weight: 1, embedding: [0, 1] },
  ]);
  // (1,1) normalized
  expect(out[0]).toBeCloseTo(Math.SQRT1_2, 5);
  expect(out[1]).toBeCloseTo(Math.SQRT1_2, 5);
});

test("tasteCentroid pushes away from disliked", () => {
  const out = tasteCentroid([
    { weight: 1, embedding: [1, 0] },
    { weight: -1, embedding: [0, 1] },
  ]);
  expect(out[0]).toBeGreaterThan(0);
  expect(out[1]).toBeLessThan(0);
});

test("tasteCentroid returns null for empty / zero vector", () => {
  expect(tasteCentroid([])).toBeNull();
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/lib/taste/vector.test.ts`

- [ ] **Step 3: Implement** `src/lib/taste/vector.ts`:

```ts
export const RATING_WEIGHTS: Record<number, number> = {
  5: 1.0,
  4: 0.5,
  3: 0.1,
  2: -0.5,
  1: -1.0,
};
export const STATUS_WEIGHTS: Record<string, number> = {
  watched: 0.3,
  watching: 0.2,
  want_to_watch: 0.15,
};

/** A rating wins over watchlist status when both exist. */
export function signalWeight(signal: { score?: number; status?: string }): number {
  if (signal.score != null) return RATING_WEIGHTS[signal.score] ?? 0;
  if (signal.status) return STATUS_WEIGHTS[signal.status] ?? 0;
  return 0;
}

export interface WeightedEmbedding {
  weight: number;
  embedding: number[];
}

/** L2-normalized weighted sum of embeddings; null when there's no usable signal. */
export function tasteCentroid(items: WeightedEmbedding[]): number[] | null {
  if (items.length === 0) return null;
  const dim = items[0].embedding.length;
  const acc = new Array(dim).fill(0);
  for (const { weight, embedding } of items) {
    for (let i = 0; i < dim; i++) acc[i] += weight * embedding[i];
  }
  const norm = Math.hypot(...acc);
  if (norm === 0) return null;
  return acc.map((x) => x / norm);
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/lib/taste/vector.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/taste/vector.ts src/lib/taste/vector.test.ts
git commit -m "feat: taste vector weighting + centroid math"
```

---

### Task 5: Match score mapping

**Files:**
- Create: `src/lib/taste/match.ts`, `src/lib/taste/match.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/taste/match.test.ts`:

```ts
import { cosineSimilarity, matchPercent } from "./match";

test("cosineSimilarity of identical vectors is 1", () => {
  expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 5);
  expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
});

test("matchPercent ramps cos 0.2->0 and 0.8->100, clamped", () => {
  expect(matchPercent(0.2)).toBe(0);
  expect(matchPercent(0.8)).toBe(100);
  expect(matchPercent(0.5)).toBe(50);
  expect(matchPercent(-0.3)).toBe(0);
  expect(matchPercent(0.95)).toBe(100);
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/lib/taste/match.test.ts`

- [ ] **Step 3: Implement** `src/lib/taste/match.ts`:

```ts
export const MATCH_RAMP_LOW = 0.2;
export const MATCH_RAMP_HIGH = 0.8;

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Map cosine similarity to a 0-100 display match via a calibrated linear ramp. */
export function matchPercent(cos: number): number {
  const t = (cos - MATCH_RAMP_LOW) / (MATCH_RAMP_HIGH - MATCH_RAMP_LOW);
  return Math.round(Math.min(1, Math.max(0, t)) * 100);
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/lib/taste/match.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/taste/match.ts src/lib/taste/match.test.ts
git commit -m "feat: cosine similarity + match-percent mapping"
```

---

### Task 6: Title embedding service

**Files:**
- Create: `src/services/title-embeddings.ts`, `src/services/title-embeddings.test.ts`

- [ ] **Step 1: Failing test** — `src/services/title-embeddings.test.ts` (live db; seed a title, embed it, assert idempotency). Use a `__vitest__` slug and clean up:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings } from "@/db/schema";
import { embedTitle } from "./title-embeddings";
import { FakeEmbedder } from "@/lib/taste/embedder";

const TMDB_ID = 999000001;

async function seedTitle() {
  const [row] = await db
    .insert(titles)
    .values({
      tmdbId: TMDB_ID,
      mediaType: "movie",
      slug: "__vitest__embed",
      title: "Vitest Movie",
      metadata: { id: TMDB_ID, title: "Vitest Movie", genres: [{ id: 1, name: "Drama" }] },
      refreshedAt: new Date(),
    })
    .onConflictDoUpdate({ target: [titles.tmdbId, titles.mediaType], set: { slug: "__vitest__embed" } })
    .returning();
  return row;
}

afterAll(async () => {
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_ID));
});

test("embedTitle stores an embedding and is idempotent on unchanged descriptor", async () => {
  const title = await seedTitle();
  const embedder = new FakeEmbedder();

  await embedTitle(title.id, embedder);
  const [first] = await db.select().from(titleEmbeddings).where(eq(titleEmbeddings.titleId, title.id));
  expect(first.embedding).toHaveLength(1024);
  expect(first.model).toBe("fake");

  // Re-run: same descriptor → built_at unchanged (skipped).
  await embedTitle(title.id, embedder);
  const [second] = await db.select().from(titleEmbeddings).where(eq(titleEmbeddings.titleId, title.id));
  expect(second.builtAt.getTime()).toBe(first.builtAt.getTime());
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/services/title-embeddings.test.ts`

- [ ] **Step 3: Implement** `src/services/title-embeddings.ts`:

```ts
import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings } from "@/db/schema";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { buildTasteDescriptor, descriptorHash } from "@/lib/taste/descriptor";
import type { Embedder } from "@/lib/taste/embedder";

/** Embed a single title's taste descriptor; no-op if the descriptor is unchanged. */
export async function embedTitle(titleId: string, embedder: Embedder): Promise<void> {
  const [title] = await db.select().from(titles).where(eq(titles.id, titleId));
  if (!title) return;
  const meta = (title.metadata ?? {}) as TmdbTitleDetail;
  const descriptor = buildTasteDescriptor(meta, title.mediaType);
  const hash = descriptorHash(descriptor);

  const [existing] = await db
    .select({ hash: titleEmbeddings.descriptorHash })
    .from(titleEmbeddings)
    .where(eq(titleEmbeddings.titleId, titleId));
  if (existing && existing.hash === hash) return; // unchanged

  const [embedding] = await embedder.embed([descriptor], "document");
  await db
    .insert(titleEmbeddings)
    .values({ titleId, embedding, model: embedder.model, descriptorHash: hash, builtAt: new Date() })
    .onConflictDoUpdate({
      target: titleEmbeddings.titleId,
      set: { embedding, model: embedder.model, descriptorHash: hash, builtAt: new Date() },
    });
}

/** Embed up to `limit` local titles that have no embedding yet (cron/backfill). */
export async function embedMissing(limit: number, embedder: Embedder): Promise<number> {
  const rows = await db
    .select({ id: titles.id })
    .from(titles)
    .leftJoin(titleEmbeddings, eq(titleEmbeddings.titleId, titles.id))
    .where(isNull(titleEmbeddings.titleId))
    .limit(limit);
  for (const r of rows) await embedTitle(r.id, embedder);
  return rows.length;
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/services/title-embeddings.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/services/title-embeddings.ts src/services/title-embeddings.test.ts
git commit -m "feat: title embedding service (embedTitle + embedMissing)"
```

---

### Task 7: Taste recompute service

**Files:**
- Create: `src/services/taste.ts`, `src/services/taste.test.ts`

- [ ] **Step 1: Failing test** — `src/services/taste.test.ts` (seed a profile + two titles with embeddings + ratings; recompute; assert vector + count). Reuse the `__vitest__` cleanup pattern:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, titles, titleEmbeddings, ratings, userTaste } from "@/db/schema";
import { recomputeTaste } from "./taste";

const TMDB_A = 999000010, TMDB_B = 999000011;
let userId: string, titleA: string, titleB: string;

beforeAll(async () => {
  const [p] = await db.insert(profiles).values({
    clerkUserId: "__vitest__taste", username: "__vitest__taste",
  }).returning();
  userId = p.id;
  for (const [tmdb, slug, setId] of [[TMDB_A, "a", "A"], [TMDB_B, "b", "B"]] as const) {
    const [t] = await db.insert(titles).values({
      tmdbId: tmdb, mediaType: "movie", slug: `__vitest__${slug}`, title: `T${setId}`,
      metadata: {}, refreshedAt: new Date(),
    }).returning();
    if (setId === "A") titleA = t.id; else titleB = t.id;
    await db.insert(titleEmbeddings).values({
      titleId: t.id, model: "fake", descriptorHash: setId,
      embedding: setId === "A" ? unit([1, 0]) : unit([0, 1]),
    });
  }
});

afterAll(async () => {
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_A));
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_B));
  await db.delete(profiles).where(eq(profiles.id, userId));
});

function unit(v: number[]): number[] {
  const out = new Array(1024).fill(0);
  out[0] = v[0]; out[1] = v[1];
  const n = Math.hypot(...out) || 1;
  return out.map((x) => x / n);
}

test("recomputeTaste builds a vector leaning toward liked, away from disliked", async () => {
  await db.insert(ratings).values([
    { userId, titleId: titleA, score: 5 },
    { userId, titleId: titleB, score: 1 },
  ]);
  const res = await recomputeTaste(userId);
  expect(res?.ratedCount).toBe(2);
  const [row] = await db.select().from(userTaste).where(eq(userTaste.userId, userId));
  expect(row.embedding[0]).toBeGreaterThan(0); // toward A
  expect(row.embedding[1]).toBeLessThan(0); // away from B
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/services/taste.test.ts`

- [ ] **Step 3: Implement** `src/services/taste.ts`:

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ratings, watchlistItems, titleEmbeddings, userTaste } from "@/db/schema";
import { signalWeight, tasteCentroid, type WeightedEmbedding } from "@/lib/taste/vector";

export interface TasteResult {
  ratedCount: number;
}

/** Recompute and persist a user's taste vector from their rated + watchlisted embedded titles. */
export async function recomputeTaste(userId: string): Promise<TasteResult | null> {
  const rated = await db
    .select({ titleId: ratings.titleId, score: ratings.score, embedding: titleEmbeddings.embedding })
    .from(ratings)
    .innerJoin(titleEmbeddings, eq(titleEmbeddings.titleId, ratings.titleId))
    .where(eq(ratings.userId, userId));

  const watched = await db
    .select({ titleId: watchlistItems.titleId, status: watchlistItems.status, embedding: titleEmbeddings.embedding })
    .from(watchlistItems)
    .innerJoin(titleEmbeddings, eq(titleEmbeddings.titleId, watchlistItems.titleId))
    .where(eq(watchlistItems.userId, userId));

  // Ratings take precedence over watchlist status for the same title.
  const byTitle = new Map<string, WeightedEmbedding>();
  for (const w of watched) {
    byTitle.set(w.titleId, { weight: signalWeight({ status: w.status }), embedding: w.embedding });
  }
  for (const r of rated) {
    byTitle.set(r.titleId, { weight: signalWeight({ score: r.score }), embedding: r.embedding });
  }

  const items = [...byTitle.values()].filter((i) => i.weight !== 0);
  const centroid = tasteCentroid(items);
  const ratedCount = rated.length;

  if (!centroid) {
    await db.delete(userTaste).where(eq(userTaste.userId, userId));
    return null;
  }
  await db
    .insert(userTaste)
    .values({ userId, embedding: centroid, ratedCount, builtAt: new Date() })
    .onConflictDoUpdate({ target: userTaste.userId, set: { embedding: centroid, ratedCount, builtAt: new Date() } });
  return { ratedCount };
}

export async function getTaste(userId: string) {
  const [row] = await db.select().from(userTaste).where(eq(userTaste.userId, userId));
  return row ?? null;
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/services/taste.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/services/taste.ts src/services/taste.test.ts
git commit -m "feat: recomputeTaste service"
```

---

### Task 8: For-you ANN query + batch match

**Files:**
- Create: `src/services/for-you.ts`, `src/services/for-you.test.ts`

- [ ] **Step 1: Failing test** — `src/services/for-you.test.ts` (reuse the seeding shape from Task 7: a user with taste leaning toward A; an unrated title C near A should rank first and exclude rated A/B):

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, titles, titleEmbeddings, ratings, userTaste } from "@/db/schema";
import { forYou } from "./for-you";

// ... seed profile, titles A/B/C with embeddings unit([1,0]),[0,1],[0.9,0.1];
// rate A=5,B=1; set userTaste embedding ~ unit([1,0]); (see Task 7 helpers)

test("forYou returns nearest unseen titles, excluding rated, with match%", async () => {
  const res = await forYou(userId, 10);
  const ids = res.map((r) => r.titleId);
  expect(ids).toContain(titleC); // unseen, near taste
  expect(ids).not.toContain(titleA); // already rated
  expect(ids).not.toContain(titleB);
  expect(res[0].match).toBeGreaterThan(0);
});
```

(Include the full seed/cleanup in the test mirroring Task 7; set `userTaste` directly so the test doesn't depend on `recomputeTaste`.)

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/services/for-you.test.ts`

- [ ] **Step 3: Implement** `src/services/for-you.ts`:

```ts
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings, userTaste, ratings, watchlistItems } from "@/db/schema";
import { toVectorLiteral } from "@/db/vector";
import { matchPercent } from "@/lib/taste/match";
import { titleSlug } from "@/lib/slug";
import { posterUrl } from "@/lib/tmdb/images";

export interface ForYouItem {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  match: number;
}

export async function forYou(userId: string, limit = 24): Promise<ForYouItem[]> {
  const [taste] = await db.select().from(userTaste).where(sql`${userTaste.userId} = ${userId}`);
  if (!taste) return [];
  const vec = toVectorLiteral(taste.embedding);

  // cosine similarity = 1 - cosine distance (<=>). Exclude titles the user already rated or watchlisted.
  const rows = await db.execute(sql`
    SELECT t.id, t.tmdb_id, t.media_type, t.title, t.release_year, t.poster_path,
           1 - (te.embedding <=> ${vec}::vector) AS cos
    FROM ${titleEmbeddings} te
    JOIN ${titles} t ON t.id = te.title_id
    WHERE t.id NOT IN (
      SELECT title_id FROM ${ratings} WHERE user_id = ${userId}
      UNION
      SELECT title_id FROM ${watchlistItems} WHERE user_id = ${userId}
    )
    ORDER BY te.embedding <=> ${vec}::vector
    LIMIT ${limit}
  `);

  return (rows.rows as Record<string, unknown>[]).map((r) => {
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

/** Batch match% for specific titles (those that have embeddings). */
export async function matchForTitles(userId: string, titleIds: string[]): Promise<Record<string, number>> {
  if (titleIds.length === 0) return {};
  const [taste] = await db.select().from(userTaste).where(sql`${userTaste.userId} = ${userId}`);
  if (!taste) return {};
  const vec = toVectorLiteral(taste.embedding);
  const rows = await db.execute(sql`
    SELECT title_id, 1 - (embedding <=> ${vec}::vector) AS cos
    FROM ${titleEmbeddings}
    WHERE title_id IN (${sql.join(titleIds.map((id) => sql`${id}`), sql`, `)})
  `);
  const out: Record<string, number> = {};
  for (const r of rows.rows as Record<string, unknown>[]) {
    out[r.title_id as string] = matchPercent(r.cos as number);
  }
  return out;
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/services/for-you.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/services/for-you.ts src/services/for-you.test.ts
git commit -m "feat: for-you ANN query + batch match service"
```

---

### Task 9: Background hooks (embed-on-mirror, after-rating)

**Files:**
- Create: `src/services/taste-hooks.ts`
- Modify: `src/app/title/[mediaType]/[idSlug]/page.tsx` (embed after view), `src/app/api/v1/me/ratings/route.ts` (recompute after rating), `src/app/api/v1/me/watchlist/route.ts` (recompute after change)

- [ ] **Step 1: Implement hooks** — `src/services/taste-hooks.ts`:

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { titles } from "@/db/schema";
import { tmdb } from "@/lib/tmdb/client";
import { getOrCreateTitle } from "@/services/catalog";
import { embedTitle } from "@/services/title-embeddings";
import { recomputeTaste } from "@/services/taste";
import { defaultEmbedder } from "@/lib/taste/embedder";
import type { TmdbSearchItem } from "@/lib/tmdb/types";

/** Embed a title after it's been viewed (safe to call in `after()`). */
export async function onTitleViewed(titleId: string): Promise<void> {
  try {
    await embedTitle(titleId, defaultEmbedder());
  } catch {
    /* embeddings are best-effort */
  }
}

/** After a rating/watchlist change: embed the title + a few "similar", then recompute taste. */
export async function onSignalChanged(userId: string, mediaType: "movie" | "tv", tmdbId: number): Promise<void> {
  const embedder = defaultEmbedder();
  try {
    const title = await getOrCreateTitle(mediaType, tmdbId);
    await embedTitle(title.id, embedder);
    // Expand the candidate pool with TMDB "similar"/recommendations (best-effort, capped).
    const meta = (title.metadata ?? {}) as { recommendations?: { results?: TmdbSearchItem[] } };
    const recs = (meta.recommendations?.results ?? []).filter(
      (r) => r.media_type === "movie" || r.media_type === "tv",
    ).slice(0, 8);
    for (const r of recs) {
      const row = await getOrCreateTitle(r.media_type as "movie" | "tv", r.id);
      await embedTitle(row.id, embedder);
    }
  } catch {
    /* best-effort */
  }
  try {
    await recomputeTaste(userId);
  } catch {
    /* best-effort */
  }
}
```

- [ ] **Step 2: Wire title view** — in the title detail page, after computing `title`, schedule embedding without blocking render. Add at top: `import { after } from "next/server";` and `import { onTitleViewed } from "@/services/taste-hooks";`. After `const meta = ...`:

```tsx
  after(() => onTitleViewed(title.id));
```

- [ ] **Step 3: Wire rating/watchlist routes** — in `me/ratings` (PUT and DELETE) and `me/watchlist` (PUT and DELETE), after the successful mutation and before returning, schedule the recompute. Add `import { after } from "next/server";` and `import { onSignalChanged } from "@/services/taste-hooks";`, then:

```ts
  after(() => onSignalChanged(profile.id, input.mediaType, input.tmdbId));
```
(Use the parsed `mediaType`/`tmdbId` already in scope in each handler.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; manually rate a title in dev and confirm a `title_embeddings` row appears and `user_taste` updates (FakeEmbedder locally). Document the check; no automated test for `after()` wiring.

- [ ] **Step 5: Commit**

```bash
git add src/services/taste-hooks.ts "src/app/title/[mediaType]/[idSlug]/page.tsx" src/app/api/v1/me/ratings/route.ts src/app/api/v1/me/watchlist/route.ts
git commit -m "feat: background taste hooks (embed-on-view, recompute-on-signal)"
```

---

### Task 10: API routes — /me/for-you and /me/match

**Files:**
- Create: `src/app/api/v1/me/for-you/route.ts`, `src/app/api/v1/me/match/route.ts`

- [ ] **Step 1: Implement `for-you` route** — `src/app/api/v1/me/for-you/route.ts`:

```ts
import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { getTaste } from "@/services/taste";
import { forYou } from "@/services/for-you";
import { jsonError } from "@/lib/api";

const COLD_START_MIN = 5;

export async function GET() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");

  const taste = await getTaste(profile.id);
  if (!taste || taste.ratedCount < COLD_START_MIN) {
    return NextResponse.json({ needsMoreRatings: true, have: taste?.ratedCount ?? 0, need: COLD_START_MIN, items: [] });
  }
  const items = await forYou(profile.id, 24);
  return NextResponse.json({ needsMoreRatings: false, items });
}
```

- [ ] **Step 2: Implement `match` route** — `src/app/api/v1/me/match/route.ts`:

```ts
import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { matchForTitles } from "@/services/for-you";

export async function GET(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ match: {} }); // anon: no scores, not an error

  const ids = new URL(req.url).searchParams.get("titleIds")?.split(",").filter(Boolean) ?? [];
  const match = await matchForTitles(profile.id, ids.slice(0, 60));
  return NextResponse.json({ match });
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm run lint`. Manually hit `/api/v1/me/for-you` signed out → 401; signed in with < 5 ratings → `needsMoreRatings: true`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/me/for-you/route.ts src/app/api/v1/me/match/route.ts
git commit -m "feat: me/for-you + me/match API routes"
```

---

### Task 11: Popular-pool cron

**Files:**
- Create: `src/app/api/cron/embed-popular/route.ts`, `vercel.json`
- Modify: `src/lib/tmdb/client.ts` (add `popular`)

- [ ] **Step 1: Add TMDB popular** — in `src/lib/tmdb/client.ts` `tmdb`:

```ts
  popular: (mediaType: "movie" | "tv", page = 1) =>
    get<{ results: TmdbSearchItem[] }>(`/${mediaType}/popular`, { page: String(page) }),
```

- [ ] **Step 2: Implement cron route** — `src/app/api/cron/embed-popular/route.ts` (mirror + embed a batch; auth via `CRON_SECRET`):

```ts
import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { getOrCreateTitle } from "@/services/catalog";
import { embedTitle, embedMissing } from "@/services/title-embeddings";
import { defaultEmbedder } from "@/lib/taste/embedder";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const embedder = defaultEmbedder();
  let mirrored = 0;
  for (const mediaType of ["movie", "tv"] as const) {
    try {
      const { results } = await tmdb.popular(mediaType, 1);
      for (const r of results.slice(0, 20)) {
        const row = await getOrCreateTitle(mediaType, r.id);
        await embedTitle(row.id, embedder);
        mirrored++;
      }
    } catch {
      /* skip on TMDB error */
    }
  }
  const backfilled = await embedMissing(40, embedder);
  return NextResponse.json({ mirrored, backfilled });
}
```

- [ ] **Step 3: Schedule it** — create `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/embed-popular", "schedule": "0 4 * * *" }]
}
```
(Vercel automatically sends `Authorization: Bearer $CRON_SECRET` to cron paths when `CRON_SECRET` is set.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npm run build`. Locally: `curl -H "authorization: Bearer test" localhost:3000/api/cron/embed-popular` with `CRON_SECRET=test` returns counts.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/embed-popular/route.ts vercel.json src/lib/tmdb/client.ts
git commit -m "feat: popular-pool embedding cron"
```

---

### Task 12: MatchBadge island + detail-page match

**Files:**
- Create: `src/components/catalog/MatchBadge.tsx`, `src/components/catalog/useMatch.ts`, `src/components/catalog/TitleMatch.tsx`
- Modify: `src/app/title/[mediaType]/[idSlug]/page.tsx` (render the client `TitleMatch` island in the hero meta row)

**Note:** match must be a **client island** (like `TitleActions`/`WhereToWatchClient`) so the title page stays PPR-cacheable and user-independent — do NOT fetch the profile/match server-side in the page.

- [ ] **Step 1: Match hook** — `src/components/catalog/useMatch.ts`:

```ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";

/** Fetch match% for a set of title ids (shared query so a page batches once). */
export function useMatches(titleIds: string[]) {
  const key = [...titleIds].sort().join(",");
  return useQuery({
    queryKey: ["match", key],
    enabled: titleIds.length > 0,
    queryFn: () =>
      meFetch<{ match: Record<string, number> }>(
        `/api/v1/me/match?titleIds=${encodeURIComponent(titleIds.join(","))}`,
      )
        .then((r) => r.match)
        .catch(() => ({})),
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Badge component** — `src/components/catalog/MatchBadge.tsx`:

```tsx
export function MatchBadge({ match }: { match: number | undefined }) {
  if (match == null) return null;
  const tone = match >= 75 ? "text-success" : match >= 50 ? "text-warning" : "text-text-muted";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-surface-raised/90 px-2 py-0.5 text-xs font-medium ${tone}`}>
      {match}% match
    </span>
  );
}
```

- [ ] **Step 3: Detail match island** — `src/components/catalog/TitleMatch.tsx` (client; fetches its own match so the page stays PPR-cacheable):

```tsx
"use client";
import { useMatches } from "./useMatch";
import { MatchBadge } from "./MatchBadge";

export function TitleMatch({ titleId }: { titleId: string }) {
  const { data } = useMatches([titleId]);
  return <MatchBadge match={data?.[titleId]} />;
}
```

- [ ] **Step 4: Render in the hero** — in the title page, add `import { TitleMatch } from "@/components/catalog/TitleMatch";` and place `<TitleMatch titleId={title.id} />` in the hero meta row (after the rating span). No server profile fetch — the island self-fetches via `me/match` and renders nothing when signed out / no taste / no embedding.

- [ ] **Step 5: Verify** — `npx tsc --noEmit && npm run lint`. With a seeded taste + embedded title, the badge shows on revisit; signed out, it's absent; the page remains PPR (`◐`) in the build output.

- [ ] **Step 6: Commit**

```bash
git add src/components/catalog/MatchBadge.tsx src/components/catalog/useMatch.ts src/components/catalog/TitleMatch.tsx "src/app/title/[mediaType]/[idSlug]/page.tsx"
git commit -m "feat: MatchBadge + detail-page match island"
```

---

### Task 13: /for-you page + nav

**Files:**
- Create: `src/app/for-you/page.tsx`, `src/app/for-you/loading.tsx`, `src/app/for-you/ForYouGrid.tsx`
- Modify: `src/services/site-config.ts` (add "For you" to the fallback nav)

- [ ] **Step 1: Client grid** — `src/app/for-you/ForYouGrid.tsx` (fetches the feed via React Query, shows match on each card):

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { meFetch } from "@/lib/me-client";
import { TitleCard } from "@/components/catalog/TitleCard";
import { MatchBadge } from "@/components/catalog/MatchBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";
import type { ForYouItem } from "@/services/for-you";

interface FeedResponse { needsMoreRatings: boolean; have?: number; need?: number; items: ForYouItem[] }

export function ForYouGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ["for-you"],
    queryFn: () => meFetch<FeedResponse>("/api/v1/me/for-you"),
  });

  if (isLoading) return <PosterGridSkeleton />;
  if (!data || data.needsMoreRatings) {
    return (
      <EmptyState
        title="Rate a few titles to unlock your matches"
        description={`Rate at least ${data?.need ?? 5} movies or shows and we'll build your taste profile.`}
      />
    );
  }
  if (data.items.length === 0) {
    return <EmptyState title="Nothing to recommend yet" description="Check back as your taste profile grows." />;
  }
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {data.items.map((item) => (
        <div key={item.titleId} className="relative">
          <div className="absolute left-1.5 top-1.5 z-10"><MatchBadge match={item.match} /></div>
          <TitleCard href={item.href} title={item.title} year={item.year} posterUrl={item.posterUrl} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Page + loading** — `src/app/for-you/page.tsx`:

```tsx
import { ForYouGrid } from "./ForYouGrid";

export const metadata = { title: "For you" };

export default function ForYouPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-text">For you</h1>
      <ForYouGrid />
    </div>
  );
}
```
`src/app/for-you/loading.tsx`:

```tsx
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";

export default function ForYouLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 h-8 w-40 animate-pulse rounded-md bg-surface-overlay" />
      <PosterGridSkeleton />
    </div>
  );
}
```

- [ ] **Step 3: Nav link** — in `src/services/site-config.ts`, add `{ href: "/for-you", label: "For you" }` to the fallback `getNavLinks` default (after Home, before Movies, or per taste). Verify the existing fallback shape first.

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npm run lint && npm run build`. Visit `/for-you`: signed out → sign-in behavior of `me/for-you` (badge/empty); signed in < 5 ratings → "rate a few" state; with taste → grid with match badges.

- [ ] **Step 5: Commit**

```bash
git add src/app/for-you/ src/services/site-config.ts
git commit -m "feat: /for-you page with match badges + nav link"
```

---

### Task 14: Full verification

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npm run lint` → clean.
- [ ] **Step 3:** `npm test` → all green (new pure + service tests pass with FakeEmbedder).
- [ ] **Step 4:** `npm run build` → compiles; `/for-you` and the two `me/*` routes + cron route present.
- [ ] **Step 5:** Manual smoke (dev, FakeEmbedder): rate 5 titles → `/for-you` populates with match badges; a title detail page shows a match score on revisit.
- [ ] **Step 6:** Commit any fixups; the branch is ready to merge to `main` (which auto-deploys). Note: real embeddings require `VOYAGE_API_KEY` + `CRON_SECRET` in Vercel before the feed is meaningful in production.
