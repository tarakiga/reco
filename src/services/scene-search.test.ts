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
