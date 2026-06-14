import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { tmdb } from "@/lib/tmdb/client";
import { getOrCreateTitle } from "@/services/catalog";
import { posterUrl } from "@/lib/tmdb/images";
import { sample, buildDiscoverParams, selectedProviders, mapProviders, type ProviderVM } from "@/lib/shuffle/core";
import type { TmdbTitleDetail, TmdbSearchItem } from "@/lib/tmdb/types";

export interface ShufflePick {
  titleId: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterUrl: string | null;
  href: string;
  providers: ProviderVM[];
}

export interface ShuffleOpts {
  region: string;
  services: number[];
  mediaType: "movie" | "tv" | "any";
  genres: number[];
  matchTaste: boolean;
  userId?: string;
  page?: number;
}

/** Providers available in a region, for the service picker. */
export async function regionProviders(region: string): Promise<ProviderVM[]> {
  try {
    const { results } = await tmdb.watchProviders("movie", region);
    return mapProviders(results, region);
  } catch {
    return [];
  }
}

export async function shuffle(
  opts: ShuffleOpts,
): Promise<{ picks: ShufflePick[]; broaden: boolean; pickIds: string[] }> {
  let genres = opts.genres;
  if (opts.matchTaste && opts.userId && genres.length === 0) {
    const [prof] = await db.select().from(profiles).where(eq(profiles.id, opts.userId));
    genres = prof?.preferredGenres ?? [];
  }

  const page = opts.page ?? 1;
  const params = buildDiscoverParams({ region: opts.region, services: opts.services, genres, page });
  const types: ("movie" | "tv")[] = opts.mediaType === "any" ? ["movie", "tv"] : [opts.mediaType];

  const candidates: (TmdbSearchItem & { _mt: "movie" | "tv" })[] = [];
  for (const t of types) {
    try {
      const data = await tmdb.discover(t, params);
      for (const r of data.results) candidates.push({ ...r, _mt: t });
    } catch {
      // skip a failing discover call
    }
  }

  const chosen = sample(candidates, 5);
  const pickIds: string[] = [];
  const settled = await Promise.all(
    chosen.map(async (item): Promise<ShufflePick | null> => {
      try {
        const row = await getOrCreateTitle(item._mt, item.id);
        pickIds.push(row.id);
        const meta = (row.metadata ?? {}) as TmdbTitleDetail;
        return {
          titleId: row.id,
          tmdbId: item.id,
          mediaType: item._mt,
          title: row.title,
          year: row.releaseYear,
          posterUrl: posterUrl(row.posterPath),
          href: `/title/${item._mt}/${item.id}-${row.slug}`,
          providers: selectedProviders(meta["watch/providers"], opts.region, opts.services),
        };
      } catch {
        // a single pick that won't mirror shouldn't fail the whole shuffle
        return null;
      }
    }),
  );
  const picks = settled.filter((p): p is ShufflePick => p !== null);

  return { picks, broaden: candidates.length < 5, pickIds };
}
