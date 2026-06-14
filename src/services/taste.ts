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
