import "server-only";
import { getOrCreateTitle } from "@/services/catalog";
import { embedTitle } from "@/services/title-embeddings";
import { recomputeTaste } from "@/services/taste";
import { defaultEmbedder } from "@/lib/taste/embedder";
import type { TmdbSearchItem } from "@/lib/tmdb/types";

/**
 * No-op. This used to embed a title on every view, but that let crawlers
 * walking /title/[id] by sequential id balloon the catalog + Voyage spend
 * (an uncontrolled cost on anonymous page views). Embedding now happens only
 * via the controlled cron/backfill (curated corpus) and on user signals
 * (`onSignalChanged`). Kept as a no-op so existing call sites stay safe.
 */
export async function onTitleViewed(_titleId: string): Promise<void> {
  /* intentionally does nothing — see comment above */
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
