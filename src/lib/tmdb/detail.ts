import { slugify, titleSlug } from "@/lib/slug";
import { profileUrl, posterUrl, logoUrl } from "./images";
import type { TitleResult } from "./transform";
import type { TmdbTitleDetail, TmdbCastMember, TmdbVideo } from "./types";

export type MediaType = "movie" | "tv";

export function parseIdSlug(idSlug: string): number | null {
  const m = idSlug.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

export function pickTrailerKey(videos: TmdbVideo[] | undefined): string | null {
  if (!videos) return null;
  const yt = videos.filter((v) => v.site === "YouTube");
  const trailer =
    yt.find((v) => v.type === "Trailer" && v.official) ??
    yt.find((v) => v.type === "Trailer") ??
    yt.find((v) => v.type === "Teaser") ??
    yt[0];
  return trailer ? trailer.key : null;
}

export interface CastEntry {
  tmdbId: number;
  name: string;
  character: string | null;
  profileUrl: string | null;
  href: string;
}

export function topCast(cast: TmdbCastMember[] | undefined, limit = 12): CastEntry[] {
  if (!cast) return [];
  return [...cast]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, limit)
    .map((c) => ({
      tmdbId: c.id,
      name: c.name,
      character: c.character ?? null,
      profileUrl: profileUrl(c.profile_path),
      href: `/person/${c.id}-${slugify(c.name)}`,
    }));
}

export interface KeyCrew {
  role: string;
  names: string[];
}

/** Director/Writers for movies, Creator(s) for TV — pulled from credits.crew / created_by. */
export function keyCrew(meta: TmdbTitleDetail, mediaType: MediaType): KeyCrew[] {
  const dedupe = (a: string[]) => [...new Set(a)];
  if (mediaType === "tv") {
    const creators = dedupe((meta.created_by ?? []).map((c) => c.name));
    return creators.length
      ? [{ role: creators.length > 1 ? "Creators" : "Creator", names: creators }]
      : [];
  }
  const crew = meta.credits?.crew ?? [];
  const directors = dedupe(crew.filter((c) => c.job === "Director").map((c) => c.name));
  const writers = dedupe(
    crew
      .filter((c) => c.job === "Writer" || c.job === "Screenplay" || c.job === "Story")
      .map((c) => c.name),
  ).slice(0, 3);
  const out: KeyCrew[] = [];
  if (directors.length) out.push({ role: directors.length > 1 ? "Directors" : "Director", names: directors });
  if (writers.length) out.push({ role: writers.length > 1 ? "Writers" : "Writer", names: writers });
  return out;
}

/** Age rating for a region (US default): movie release_dates / TV content_ratings. */
export function certification(meta: TmdbTitleDetail, mediaType: MediaType, region = "US"): string | null {
  if (mediaType === "movie") {
    const entry = meta.release_dates?.results?.find((r) => r.iso_3166_1 === region);
    const cert = entry?.release_dates?.map((d) => d.certification).find((c) => c && c.trim());
    return cert?.trim() || null;
  }
  const entry = meta.content_ratings?.results?.find((r) => r.iso_3166_1 === region);
  return entry?.rating?.trim() || null;
}

/** "More like this" — TMDB recommendations mapped to title cards. */
export function recommendations(meta: TmdbTitleDetail, limit = 12): TitleResult[] {
  const items = meta.recommendations?.results ?? [];
  const out: TitleResult[] = [];
  for (const it of items) {
    if (it.media_type !== "movie" && it.media_type !== "tv") continue;
    const name = it.title ?? it.name ?? "Untitled";
    const date = it.release_date ?? it.first_air_date ?? "";
    const year = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
    out.push({
      kind: "title",
      mediaType: it.media_type,
      tmdbId: it.id,
      title: name,
      year: Number.isFinite(year) ? year : null,
      releaseDate: date || null,
      posterUrl: posterUrl(it.poster_path),
      href: `/title/${it.media_type}/${it.id}-${titleSlug(name, date || null)}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function formatRuntime(min: number | undefined | null): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

export function formatMoney(n: number | undefined | null): string | null {
  if (!n || n <= 0) return null;
  return `$${n.toLocaleString("en-US")}`;
}

/** Total binge duration as a compact "2d 1h" / "8h" / "45m" string. */
export function formatBinge(min: number | undefined | null): string | null {
  if (!min || min <= 0) return null;
  if (min < 60) return `${min}m`;
  const totalHours = Math.round(min / 60);
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  return `${h}h`;
}

function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export interface Fact {
  label: string;
  value: string;
  tone?: "default" | "money";
  /** Optional logo (e.g. the network) rendered in place of plain text. */
  imageUrl?: string;
}

/** Type-appropriate facts for the detail sidebar. */
export function titleFacts(meta: TmdbTitleDetail, mediaType: MediaType): Fact[] {
  const facts: Fact[] = [];
  if (meta.status) facts.push({ label: "Status", value: meta.status });
  if (meta.original_language) {
    facts.push({ label: "Original language", value: languageName(meta.original_language) });
  }
  if (mediaType === "movie") {
    const budget = formatMoney(meta.budget);
    const revenue = formatMoney(meta.revenue);
    if (budget) facts.push({ label: "Budget", value: budget });
    if (revenue) facts.push({ label: "Revenue", value: revenue, tone: "money" });
  } else {
    if (meta.number_of_seasons) {
      facts.push({
        label: meta.number_of_seasons > 1 ? "Seasons" : "Season",
        value: String(meta.number_of_seasons),
      });
    }
    if (meta.number_of_episodes) {
      facts.push({ label: "Episodes", value: String(meta.number_of_episodes) });
    }
    // TMDB has largely deprecated episode_run_time (often []), so fall back to a
    // single known episode runtime (last/next aired) as a per-episode estimate.
    const runtimes = (meta.episode_run_time ?? []).filter((r) => r > 0);
    const perEpisode = runtimes.length
      ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length
      : meta.last_episode_to_air?.runtime || meta.next_episode_to_air?.runtime || 0;
    if (meta.number_of_episodes && perEpisode > 0) {
      const binge = formatBinge(Math.round(meta.number_of_episodes * perEpisode));
      if (binge) facts.push({ label: "Binge watch", value: binge });
    }
    const network = meta.networks?.[0];
    if (network?.name) {
      const logo = network.logo_path ? logoUrl(network.logo_path) : null;
      facts.push({ label: "Network", value: network.name, ...(logo ? { imageUrl: logo } : {}) });
    }
  }
  return facts;
}
