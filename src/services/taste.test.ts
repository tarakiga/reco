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
