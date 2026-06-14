import "server-only";
import { cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { posterUrl } from "@/lib/tmdb/images";
import { titleSlug } from "@/lib/slug";

export interface CollectionPart {
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
}

/** Other movies in a TMDB collection (excluding the current one), oldest first. */
export async function collectionParts(collectionId: number, excludeId: number): Promise<CollectionPart[]> {
  "use cache";
  cacheTag(`collection:${collectionId}`);
  try {
    const col = await tmdb.collection(collectionId);
    return (col.parts ?? [])
      .filter((p) => p.id !== excludeId)
      .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? ""))
      .map((p) => {
        const name = p.title ?? "Untitled";
        const date = p.release_date ?? "";
        const year = date.length >= 4 ? Number(date.slice(0, 4)) : null;
        return {
          tmdbId: p.id,
          title: name,
          year: Number.isFinite(year) ? year : null,
          posterUrl: posterUrl(p.poster_path),
          href: `/title/movie/${p.id}-${titleSlug(name, date || null)}`,
        };
      });
  } catch {
    return [];
  }
}
