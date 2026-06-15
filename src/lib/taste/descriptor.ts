import { createHash } from "node:crypto";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import type { MediaType } from "@/lib/tmdb/detail";
import { keyCrew } from "@/lib/tmdb/detail";

export function buildTasteDescriptor(meta: TmdbTitleDetail, mediaType: MediaType): string {
  const name = meta.title ?? meta.name ?? "Untitled";
  const date = meta.release_date ?? meta.first_air_date ?? "";
  const year = date.length >= 4 ? Number(date.slice(0, 4)) : null;
  const decade = year ? `${Math.floor(year / 10) * 10}s` : "";
  const genres = (meta.genres ?? []).map((g) => g.name);
  const kwList = meta.keywords?.keywords ?? meta.keywords?.results ?? [];
  const keywords = kwList.slice(0, 12).map((k) => k.name);
  const cast = (meta.credits?.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 6)
    .map((c) => c.name);
  const crew = keyCrew(meta, mediaType).flatMap((c) => c.people.map((p) => p.name));

  const parts = [
    `${mediaType === "tv" ? "TV series" : "Movie"}: ${name}`,
    decade && `Era: ${decade}`,
    genres.length && `Genres: ${genres.join(", ")}`,
    keywords.length && `Themes: ${keywords.join(", ")}`,
    crew.length && `By: ${crew.join(", ")}`,
    cast.length && `Starring: ${cast.join(", ")}`,
    meta.overview && `Synopsis: ${meta.overview}`,
  ].filter(Boolean);
  return parts.join("\n");
}

export function descriptorHash(descriptor: string): string {
  return createHash("sha256").update(descriptor).digest("hex");
}
