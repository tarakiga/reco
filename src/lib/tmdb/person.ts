import { titleSlug } from "@/lib/slug";
import { posterUrl } from "./images";
import type { TitleResult } from "./transform";
import type { TmdbPersonDetail } from "./types";

export interface FilmographyCredit extends TitleResult {
  /** The actor's role in this title (TMDB `character`). */
  character: string | null;
  /** Episodes the actor appeared in (TV only), per TMDB. */
  episodeCount: number | null;
}

/** An actor's guest appearance in a single TV episode. */
export interface PersonEpisode {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  year: number | null;
  /** The character they played in THIS episode (can differ across episodes). */
  character: string | null;
}
/** How an actor appears in a TV show — series regular, or specific guest episodes. */
export interface PersonShowCredit {
  mainCast: boolean;
  episodes: PersonEpisode[];
  /** For regulars (from aggregate_credits): total episodes + role. */
  episodeCount?: number | null;
  character?: string | null;
}

export function filmography(
  credits: TmdbPersonDetail["combined_credits"] | undefined,
): FilmographyCredit[] {
  const cast = credits?.cast ?? [];
  const seen = new Set<number>();
  const out: { result: FilmographyCredit; date: string }[] = [];
  for (const c of cast) {
    if (c.media_type !== "movie" && c.media_type !== "tv") continue;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const name = c.title ?? c.name ?? "Untitled";
    const date = c.release_date ?? c.first_air_date ?? "";
    const year = date && date.length >= 4 ? Number(date.slice(0, 4)) : null;
    out.push({
      date,
      result: {
        kind: "title",
        mediaType: c.media_type,
        tmdbId: c.id,
        title: name,
        year: Number.isFinite(year) ? year : null,
        releaseDate: date || null,
        posterUrl: posterUrl(c.poster_path),
        href: `/title/${c.media_type}/${c.id}-${titleSlug(name, date || null)}`,
        character: c.character || null,
        episodeCount: c.episode_count ?? null,
      },
    });
  }
  // newest first; undated (empty string) sorts last
  out.sort((a, b) => (b.date || "0").localeCompare(a.date || "0"));
  return out.map((o) => o.result);
}

export interface PersonFact {
  label: string;
  value: string;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Whole years between two ISO dates (yyyy-mm-dd). Exported for deterministic testing. */
export function ageBetween(birth: string, end: string): number | null {
  const b = new Date(`${birth}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(b.getTime()) || Number.isNaN(e.getTime())) return null;
  let age = e.getUTCFullYear() - b.getUTCFullYear();
  const m = e.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && e.getUTCDate() < b.getUTCDate())) age--;
  return age >= 0 ? age : null;
}

export function personFacts(
  meta: Pick<
    TmdbPersonDetail,
    "known_for_department" | "birthday" | "deathday" | "place_of_birth"
  >,
  today = new Date().toISOString().slice(0, 10),
): PersonFact[] {
  const facts: PersonFact[] = [];
  if (meta.known_for_department) {
    facts.push({ label: "Known for", value: meta.known_for_department });
  }
  if (meta.birthday) {
    const livingAge = meta.deathday ? null : ageBetween(meta.birthday, today);
    facts.push({
      label: "Born",
      value: livingAge != null ? `${formatDate(meta.birthday)} (age ${livingAge})` : formatDate(meta.birthday),
    });
  }
  if (meta.deathday) {
    const atDeath = meta.birthday ? ageBetween(meta.birthday, meta.deathday) : null;
    facts.push({
      label: "Died",
      value: atDeath != null ? `${formatDate(meta.deathday)} (age ${atDeath})` : formatDate(meta.deathday),
    });
  }
  if (meta.place_of_birth) {
    facts.push({ label: "Place of birth", value: meta.place_of_birth });
  }
  return facts;
}
