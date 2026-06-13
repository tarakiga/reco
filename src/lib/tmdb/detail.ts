import { slugify } from "@/lib/slug";
import { profileUrl } from "./images";
import type { TmdbCastMember, TmdbVideo } from "./types";

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
