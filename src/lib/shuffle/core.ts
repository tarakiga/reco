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

/** Well-known free / ad-supported services — surfaced in the picker even though
 *  they rank low by display priority (Tubi ~277, Pluto ~70, etc.). */
const FREE_SERVICE_PATTERNS = [/tubi/i, /pluto/i, /freevee/i, /\bplex\b/i, /crackle/i, /roku channel/i];
export function isFreeService(name: string): boolean {
  return FREE_SERVICE_PATTERNS.some((re) => re.test(name));
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
    // include free + ad-supported so services like Tubi/Pluto return their catalog
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
    "vote_count.gte": "100",
    page: String(opts.page),
  };
  if (opts.services.length) p.with_watch_providers = opts.services.join("|"); // | = OR (any service)
  if (opts.genres.length) p.with_genres = opts.genres.join("|");
  return p;
}

/**
 * Region's providers for the picker: the top `limit` by display priority, PLUS
 * any well-known free/ad services present in the region (which rank too low to
 * make the cut otherwise). Sorted by priority within each group.
 */
export function mapProviders(list: TmdbProviderListItem[], region: string, limit = 18): ProviderVM[] {
  const prio = (p: TmdbProviderListItem) => p.display_priorities?.[region] ?? p.display_priority ?? 999;
  const sorted = [...list].sort((a, b) => prio(a) - prio(b));
  const top = sorted.slice(0, limit);
  const inTop = new Set(top.map((p) => p.provider_id));
  const free = sorted.filter((p) => isFreeService(p.provider_name) && !inTop.has(p.provider_id));
  return [...top, ...free].map((p) => ({ id: p.provider_id, name: p.provider_name, logoUrl: logoUrl(p.logo_path) }));
}

/**
 * Providers a title is watchable on for free or with the subscription
 * (flatrate + free + ads), limited to the viewer's chosen services.
 */
export function selectedProviders(
  watch: TmdbTitleDetail["watch/providers"] | undefined,
  region: string,
  services: number[],
): ProviderVM[] {
  const rp = providersForRegion(watch, region);
  if (!rp) return [];
  const seen = new Set<number>();
  return [...rp.flatrate, ...rp.free, ...rp.ads].filter((p) => {
    if (!services.includes(p.id) || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}
