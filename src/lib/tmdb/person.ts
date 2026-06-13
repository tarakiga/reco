import { titleSlug } from "@/lib/slug";
import { posterUrl } from "./images";
import type { TitleResult } from "./transform";
import type { TmdbPersonDetail } from "./types";

export function filmography(
  credits: TmdbPersonDetail["combined_credits"] | undefined,
): TitleResult[] {
  const cast = credits?.cast ?? [];
  const seen = new Set<number>();
  const out: { result: TitleResult; date: string }[] = [];
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
        posterUrl: posterUrl(c.poster_path),
        href: `/title/${c.media_type}/${c.id}-${titleSlug(name, date || null)}`,
      },
    });
  }
  // newest first; undated (empty string) sorts last
  out.sort((a, b) => (b.date || "0").localeCompare(a.date || "0"));
  return out.map((o) => o.result);
}
