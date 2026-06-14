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
