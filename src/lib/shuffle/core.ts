import { logoUrl } from "@/lib/tmdb/images";
import { providersForRegion, type ProviderVM } from "@/lib/tmdb/providers";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

export type { ProviderVM };

export interface TmdbProviderListItem {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priorities?: Record<string, number>;
  display_priority?: number;
}

/** Random subset of up to n distinct members (Fisher–Yates). */
export function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export function buildDiscoverParams(opts: {
  region: string;
  services: number[];
  genres: number[];
  page: number;
}): Record<string, string> {
  const p: Record<string, string> = {
    watch_region: opts.region,
    with_watch_monetization_types: "flatrate",
    sort_by: "popularity.desc",
    "vote_count.gte": "100",
    page: String(opts.page),
  };
  if (opts.services.length) p.with_watch_providers = opts.services.join("|"); // | = OR (any service)
  if (opts.genres.length) p.with_genres = opts.genres.join("|");
  return p;
}

/** Region's providers for the picker, sorted by how prominent they are there. */
export function mapProviders(list: TmdbProviderListItem[], region: string, limit = 18): ProviderVM[] {
  const prio = (p: TmdbProviderListItem) => p.display_priorities?.[region] ?? p.display_priority ?? 999;
  return [...list]
    .sort((a, b) => prio(a) - prio(b))
    .slice(0, limit)
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logoUrl: logoUrl(p.logo_path) }));
}

/** Flatrate providers for a title in the region, limited to the chosen services. */
export function selectedProviders(
  watch: TmdbTitleDetail["watch/providers"] | undefined,
  region: string,
  services: number[],
): ProviderVM[] {
  const rp = providersForRegion(watch, region);
  return (rp?.flatrate ?? []).filter((p) => services.includes(p.id));
}
