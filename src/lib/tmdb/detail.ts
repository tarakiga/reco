import { slugify, titleSlug } from "@/lib/slug";
import { estimatedVodYmd, shiftYmd } from "@/lib/release";
import { profileUrl, posterUrl, logoUrl } from "./images";
import type { TitleResult } from "./transform";
import type { TmdbTitleDetail, TmdbCastMember, TmdbVideo, TmdbAggregateCastMember } from "./types";

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

/** Full-series cast from /tv aggregate_credits (includes regulars who left
 *  before the final season, e.g. someone billed across seasons 1–4 of 8). */
export function aggregateCast(
  cast: TmdbAggregateCastMember[] | undefined,
  limit = 18,
): CastEntry[] {
  if (!cast) return [];
  return [...cast]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, limit)
    .map((c) => ({
      tmdbId: c.id,
      name: c.name,
      character: c.roles?.[0]?.character ?? null,
      profileUrl: profileUrl(c.profile_path),
      href: `/person/${c.id}-${slugify(c.name)}`,
    }));
}

export interface CrewPerson {
  id: number;
  name: string;
  href: string;
}
export interface KeyCrew {
  role: string;
  people: CrewPerson[];
}

/** Dedupe a crew list by person id, mapping to linkable people. */
function toCrewPeople(list: { id: number; name: string }[]): CrewPerson[] {
  const seen = new Set<number>();
  const out: CrewPerson[] = [];
  for (const p of list) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, name: p.name, href: `/person/${p.id}-${slugify(p.name)}` });
  }
  return out;
}

/** Director/Writers for movies, Creator(s) for TV — pulled from credits.crew / created_by. */
export function keyCrew(meta: TmdbTitleDetail, mediaType: MediaType): KeyCrew[] {
  if (mediaType === "tv") {
    const creators = toCrewPeople(meta.created_by ?? []);
    return creators.length
      ? [{ role: creators.length > 1 ? "Creators" : "Creator", people: creators }]
      : [];
  }
  const crew = meta.credits?.crew ?? [];
  const directors = toCrewPeople(crew.filter((c) => c.job === "Director"));
  const writers = toCrewPeople(
    crew.filter((c) => c.job === "Writer" || c.job === "Screenplay" || c.job === "Story"),
  ).slice(0, 3);
  const out: KeyCrew[] = [];
  if (directors.length) out.push({ role: directors.length > 1 ? "Directors" : "Director", people: directors });
  if (writers.length) out.push({ role: writers.length > 1 ? "Writers" : "Writer", people: writers });
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

// TMDB release-date types: 1 Premiere, 2 Theatrical (limited), 3 Theatrical,
// 4 Digital, 5 Physical, 6 TV. We surface the cinema date (theatrical, with a
// limited/premiere fallback) and the digital/VOD date.
const CINEMA_TYPES = [3, 2, 1];
const VOD_TYPES = [4];

/**
 * Earliest release date (ISO) of the given TMDB types for a movie. Prefers the
 * region (US default), then falls back to the earliest such date in any kept
 * region. Returns null when no matching date exists.
 */
function releaseDateOfType(
  meta: TmdbTitleDetail,
  types: number[],
  region = "US",
): string | null {
  const results = meta.release_dates?.results;
  if (!results) return null;
  const pick = (entries: { type?: number; release_date?: string }[]): string | null => {
    for (const t of types) {
      const dates = entries
        .filter((d) => d.type === t && d.release_date)
        .map((d) => d.release_date as string)
        .sort();
      if (dates.length) return dates[0];
    }
    return null;
  };
  const regional = results.find((r) => r.iso_3166_1 === region);
  if (regional) {
    const hit = pick(regional.release_dates);
    if (hit) return hit;
  }
  let earliest: string | null = null;
  for (const r of results) {
    const hit = pick(r.release_dates);
    if (hit && (!earliest || hit < earliest)) earliest = hit;
  }
  return earliest;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO date -> "12 Jul 2024" (UTC, so no off-by-one near midnight). */
export function formatReleaseDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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
export function titleFacts(
  meta: TmdbTitleDetail,
  mediaType: MediaType,
  todayYmd?: string,
): Fact[] {
  const facts: Fact[] = [];
  if (meta.status) facts.push({ label: "Status", value: meta.status });
  if (meta.original_language) {
    facts.push({ label: "Original language", value: languageName(meta.original_language) });
  }
  if (mediaType === "movie") {
    const cinemaIso = releaseDateOfType(meta, CINEMA_TYPES);
    const vodIso = releaseDateOfType(meta, VOD_TYPES);
    const cinema = formatReleaseDate(cinemaIso);
    if (cinema) facts.push({ label: "In cinemas", value: cinema });
    if (vodIso) {
      const vod = formatReleaseDate(vodIso);
      if (vod) facts.push({ label: "VOD", value: vod });
    } else if (cinemaIso && todayYmd) {
      // No confirmed digital date — a common TMDB gap for smaller films. Estimate
      // from the theatrical window, but only for films still in/near their release
      // window (don't guess a VOD date for decades-old catalogue titles). Clearly
      // labelled "Est." so it never reads as a confirmed date.
      const cinemaYmd = cinemaIso.slice(0, 10);
      if (cinemaYmd >= shiftYmd(todayYmd, -120)) {
        const est = formatReleaseDate(estimatedVodYmd(cinemaYmd));
        if (est) facts.push({ label: "Est. VOD", value: est });
      }
    }
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
