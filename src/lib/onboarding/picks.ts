import type { TmdbSearchItem } from "@/lib/tmdb/types";
import { posterUrl } from "@/lib/tmdb/images";

export interface PickCard {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
}

const key = (m: "movie" | "tv", id: number) => `${m}:${id}`;

/** Interleave movie + tv discover results into pick cards; dedupe and drop excluded/posterless. */
export function blendPicks(
  movies: TmdbSearchItem[],
  tv: TmdbSearchItem[],
  opts: { exclude?: Set<string> } = {},
): PickCard[] {
  const exclude = opts.exclude ?? new Set<string>();
  const seen = new Set<string>();
  const out: PickCard[] = [];
  const max = Math.max(movies.length, tv.length);
  for (let i = 0; i < max; i++) {
    for (const [item, mt] of [
      [movies[i], "movie"] as const,
      [tv[i], "tv"] as const,
    ]) {
      if (!item || !item.poster_path) continue;
      const k = key(mt, item.id);
      if (seen.has(k) || exclude.has(k)) continue;
      seen.add(k);
      const name = item.title ?? item.name ?? "Untitled";
      const date = item.release_date ?? item.first_air_date ?? "";
      const year = date.length >= 4 ? Number(date.slice(0, 4)) : null;
      out.push({
        tmdbId: item.id,
        mediaType: mt,
        title: name,
        year: Number.isFinite(year) ? year : null,
        posterUrl: posterUrl(item.poster_path),
      });
    }
  }
  return out;
}
