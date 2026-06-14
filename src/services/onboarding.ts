import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, ratings, type TitleRow } from "@/db/schema";
import { getOrCreateTitle } from "@/services/catalog";
import { embedTitles } from "@/services/title-embeddings";
import { recomputeTaste } from "@/services/taste";
import type { Embedder } from "@/lib/taste/embedder";
import type { OnboardingInput } from "@/lib/contracts/onboarding";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

const POOL_SEED_LIMIT = 24;

/**
 * Persist onboarding selections, seed the recommendation pool, embed everything
 * in BATCHED calls, and recompute taste once.
 *
 * Ordering matters: the rating (the user's real signal) is written BEFORE any
 * embedding, and embedding is batched into a single request — so a rate-limited
 * embedder can never drop the user's ratings (the bug that left new users stuck
 * on the cold-start screen). We also embed each liked title's TMDB
 * recommendations so the For-you feed has candidates immediately.
 */
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

  // 1. Mirror + RATE each title. Ratings persist independent of embedding.
  const ratedTitleIds: string[] = [];
  const likedTitles: TitleRow[] = [];
  const seen = new Set<string>();
  for (const { ref, score } of signals) {
    seen.add(`${ref.mediaType}:${ref.tmdbId}`);
    try {
      const title = await getOrCreateTitle(ref.mediaType, ref.tmdbId);
      await db
        .insert(ratings)
        .values({ userId, titleId: title.id, score })
        .onConflictDoUpdate({ target: [ratings.userId, ratings.titleId], set: { score, ratedAt: new Date() } });
      ratedTitleIds.push(title.id);
      if (score >= 4) likedTitles.push(title);
    } catch {
      // skip a title that won't mirror; the rest still go through
    }
  }

  // 2. Seed candidate pool from liked titles' TMDB recommendations (already in metadata).
  const recRefs: { mediaType: "movie" | "tv"; tmdbId: number }[] = [];
  for (const t of likedTitles) {
    if (recRefs.length >= POOL_SEED_LIMIT) break;
    const meta = (t.metadata ?? {}) as TmdbTitleDetail;
    for (const r of meta.recommendations?.results ?? []) {
      if (r.media_type !== "movie" && r.media_type !== "tv") continue;
      const key = `${r.media_type}:${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recRefs.push({ mediaType: r.media_type, tmdbId: r.id });
      if (recRefs.length >= POOL_SEED_LIMIT) break;
    }
  }
  const recTitleIds: string[] = [];
  await Promise.all(
    recRefs.map(async (r) => {
      try {
        const row = await getOrCreateTitle(r.mediaType, r.tmdbId);
        recTitleIds.push(row.id);
      } catch {
        // skip a recommendation that won't mirror
      }
    }),
  );

  // 3. Embed picks + recommendations in batched requests (one per ≤100 titles).
  try {
    await embedTitles([...ratedTitleIds, ...recTitleIds], embedder);
  } catch {
    // best-effort: the ratings are already saved
  }

  // 4. Recompute taste once.
  await recomputeTaste(userId);
  return { ratedCount: ratedTitleIds.length };
}
