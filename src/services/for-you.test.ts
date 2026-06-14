import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, titles, titleEmbeddings, ratings, userTaste } from "@/db/schema";
import { forYou } from "./for-you";

const TMDB_A = 999000020, TMDB_B = 999000021, TMDB_C = 999000022, TMDB_D = 999000023;
let userId: string, titleA: string, titleB: string, titleC: string, titleD: string;

/** Build a 1024-dim unit vector whose first two components are v[0] and v[1]. */
function unit(v: number[]): number[] {
  const out = new Array(1024).fill(0);
  out[0] = v[0];
  out[1] = v[1];
  const n = Math.hypot(...out) || 1;
  return out.map((x) => x / n);
}

beforeAll(async () => {
  const [p] = await db
    .insert(profiles)
    .values({ clerkUserId: "__vitest__foryou", username: "__vitest__foryou" })
    .returning();
  userId = p.id;

  // Title A: unit([1,0]) — the user will have rated this (liked)
  const [tA] = await db
    .insert(titles)
    .values({
      tmdbId: TMDB_A,
      mediaType: "movie",
      slug: "__vitest__foryou_a",
      title: "ForYou Title A",
      metadata: {},
      refreshedAt: new Date(),
    })
    .returning();
  titleA = tA.id;
  await db.insert(titleEmbeddings).values({
    titleId: titleA,
    model: "fake",
    descriptorHash: "fy-A",
    embedding: unit([1, 0]),
  });

  // Title B: unit([0,1]) — the user will have rated this (disliked)
  const [tB] = await db
    .insert(titles)
    .values({
      tmdbId: TMDB_B,
      mediaType: "movie",
      slug: "__vitest__foryou_b",
      title: "ForYou Title B",
      metadata: {},
      refreshedAt: new Date(),
    })
    .returning();
  titleB = tB.id;
  await db.insert(titleEmbeddings).values({
    titleId: titleB,
    model: "fake",
    descriptorHash: "fy-B",
    embedding: unit([0, 1]),
  });

  // Title C: unit([0.9, 0.1]) — unseen, close to A (near taste vector)
  const [tC] = await db
    .insert(titles)
    .values({
      tmdbId: TMDB_C,
      mediaType: "movie",
      slug: "__vitest__foryou_c",
      title: "ForYou Title C",
      metadata: {},
      refreshedAt: new Date(),
    })
    .returning();
  titleC = tC.id;
  await db.insert(titleEmbeddings).values({
    titleId: titleC,
    model: "fake",
    descriptorHash: "fy-C",
    embedding: unit([0.9, 0.1]),
  });

  // Title D: unit([0.8, 0.2]) — a second unseen candidate (for pagination)
  const [tD] = await db
    .insert(titles)
    .values({
      tmdbId: TMDB_D,
      mediaType: "movie",
      slug: "__vitest__foryou_d",
      title: "ForYou Title D",
      metadata: {},
      refreshedAt: new Date(),
    })
    .returning();
  titleD = tD.id;
  await db.insert(titleEmbeddings).values({
    titleId: titleD,
    model: "fake",
    descriptorHash: "fy-D",
    embedding: unit([0.8, 0.2]),
  });

  // Rate A=5 (liked) and B=1 (disliked) — both are "seen"
  await db.insert(ratings).values([
    { userId, titleId: titleA, score: 5 },
    { userId, titleId: titleB, score: 1 },
  ]);

  // Insert user_taste directly: embedding ~ unit([1,0]) (taste leans toward A)
  await db.insert(userTaste).values({
    userId,
    embedding: unit([1, 0]),
    ratedCount: 2,
    builtAt: new Date(),
  });
});

afterAll(async () => {
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_A));
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_B));
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_C));
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_D));
  await db.delete(profiles).where(eq(profiles.id, userId));
});

test("forYou returns nearest unseen titles, excluding rated, with match%", async () => {
  const res = await forYou(userId, 10);
  const ids = res.map((r) => r.titleId);
  expect(ids).toContain(titleC); // unseen, near taste
  expect(ids).not.toContain(titleA); // already rated
  expect(ids).not.toContain(titleB); // already rated
  expect(res[0].match).toBeGreaterThan(0);
});

test("forYou paginates with offset (Load more)", async () => {
  // C (unit[0.9,0.1]) and D (unit[0.8,0.2]) sit far nearer the taste vector than
  // any real embedding, so they're deterministically the top two regardless of
  // other rows in the shared DB. Offset must walk past page 1 to page 2.
  const page1 = await forYou(userId, 1, 0);
  const page2 = await forYou(userId, 1, 1);
  expect(page1[0]?.titleId).toBe(titleC); // nearest
  expect(page2[0]?.titleId).toBe(titleD); // second-nearest (offset worked)
  expect(page1[0]?.titleId).not.toBe(page2[0]?.titleId);
});
