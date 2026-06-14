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
      metadata: { id: tmdb, title: `T${tmdb}`, genres: [{ id: 1, name: "Drama" }] }, refreshedAt: new Date(),
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
