import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { profiles, titles, ratings, userTaste } from "@/db/schema";
import { submitOnboarding } from "./onboarding";
import { FakeEmbedder, type EmbedInputType } from "@/lib/taste/embedder";

const TMDB_IDS = [999100001, 999100002, 999100003, 999100004, 999100005, 999100006];
let userId: string;

beforeAll(async () => {
  // Defensive: clear any leftovers from an interrupted prior run.
  await db.delete(profiles).where(inArray(profiles.clerkUserId, ["__vitest__onb", "__vitest__onb2"]));
  const [p] = await db.insert(profiles).values({ clerkUserId: "__vitest__onb", username: "__vitest__onb" }).returning();
  userId = p.id;
  for (const tmdb of TMDB_IDS) {
    await db.insert(titles).values({
      tmdbId: tmdb, mediaType: "movie", slug: `__vitest__${tmdb}`, title: `T${tmdb}`,
      // distinct names → distinct descriptors → distinct embeddings; no recommendations to seed
      metadata: { id: tmdb, title: `T${tmdb}`, genres: [{ id: 1, name: "Drama" }] }, refreshedAt: new Date(),
    });
  }
});
afterAll(async () => {
  await db.delete(titles).where(inArray(titles.tmdbId, TMDB_IDS));
  await db.delete(profiles).where(eq(profiles.id, userId));
});

test("submitOnboarding writes ratings, saves genres, builds taste", async () => {
  const res = await submitOnboarding(
    userId,
    {
      genres: [1, 2, 3],
      likes: [{ mediaType: "movie", tmdbId: TMDB_IDS[0] }],
      dislikes: [{ mediaType: "movie", tmdbId: TMDB_IDS[1] }],
    },
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

/** Embedder that throws after N successful calls — reproduces Voyage's per-minute
 *  request rate limit that broke onboarding in production. */
class RateLimitedEmbedder extends FakeEmbedder {
  calls = 0;
  constructor(private limit: number) {
    super();
  }
  async embed(texts: string[], inputType: EmbedInputType): Promise<number[][]> {
    this.calls += 1;
    if (this.calls > this.limit) throw new Error("429 rate limit exceeded");
    return super.embed(texts, inputType);
  }
}

test("rate-limited embedder still persists ALL picks (regression: onboarding cold-start stuck)", async () => {
  // Fresh user so this test is independent of the one above.
  await db.delete(profiles).where(eq(profiles.clerkUserId, "__vitest__onb2"));
  const [p] = await db.insert(profiles).values({ clerkUserId: "__vitest__onb2", username: "__vitest__onb2" }).returning();
  const uid = p.id;
  try {
    const embedder = new RateLimitedEmbedder(3); // allow only 3 embedder calls/run
    const res = await submitOnboarding(
      uid,
      { genres: [1], likes: TMDB_IDS.map((tmdbId) => ({ mediaType: "movie" as const, tmdbId })), dislikes: [] },
      embedder,
    );
    // With per-title embedding this returned 3 (rate limit killed picks 4-6 + their ratings).
    // Batched embedding must persist all 6.
    expect(res.ratedCount).toBe(6);
    expect(embedder.calls).toBeLessThanOrEqual(3); // batched, not one-call-per-title
    const [taste] = await db.select().from(userTaste).where(eq(userTaste.userId, uid));
    expect(taste).toBeTruthy();
    expect(taste.ratedCount).toBeGreaterThanOrEqual(5); // cold-start gate would open
  } finally {
    await db.delete(profiles).where(eq(profiles.id, uid));
  }
}, 30000); // live-DB: 6 picks × several DB round-trips can exceed the 5s default
