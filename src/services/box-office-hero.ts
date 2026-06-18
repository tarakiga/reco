import { tmdb } from "@/lib/tmdb/client";
import { backdropUrl, posterUrl } from "@/lib/tmdb/images";
import { boxOfficeNumberOneTitle } from "@/lib/boxoffice/mojo";
import { titleSlug } from "@/lib/slug";
import type { TmdbSearchItem } from "@/lib/tmdb/types";

export interface HeroResolution {
  /** A usable hero was produced (has an image + link). */
  ok: boolean;
  /** Which source the displayed film came from. */
  source: "boxoffice" | "popular";
  title: string | null;
  image: string | null;
  href: string | null;
  /** What Box Office Mojo returned for the #1 (null = scrape failed/blocked). */
  boxOfficeTitle: string | null;
  /** Did we resolve the box-office title to a TMDB record? */
  matchedTmdb: boolean;
}

const FAILED: HeroResolution = {
  ok: false,
  source: "popular",
  title: null,
  image: null,
  href: null,
  boxOfficeTitle: null,
  matchedTmdb: false,
};

const normTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Resolve the home hero: the real US box-office #1 (Box Office Mojo) matched to
 * a TMDB record for the backdrop + link, falling back to the most popular
 * in-cinema title when the scrape, match, or search yields nothing.
 *
 * Always returns a diagnostic object (never throws) so the admin health probe
 * can report each step. Callers that render the public hero should check `ok`.
 */
export async function resolveBoxOfficeHero(): Promise<HeroResolution> {
  let boxOfficeTitle: string | null = null;
  try {
    const data = await tmdb.nowPlaying();
    const playing = (data.results ?? []).filter((r) => !r.adult);

    let top: TmdbSearchItem | undefined;
    let source: "boxoffice" | "popular" = "boxoffice";
    let matchedTmdb = false;

    boxOfficeTitle = await boxOfficeNumberOneTitle();
    if (boxOfficeTitle) {
      const target = normTitle(boxOfficeTitle);
      top = playing.find((r) => normTitle(r.title ?? r.name ?? "") === target);
      if (!top) {
        const sr = await tmdb.searchMulti(boxOfficeTitle);
        const movies = (sr.results ?? []).filter((r) => r.media_type === "movie" && !r.adult);
        top = movies.find((r) => normTitle(r.title ?? "") === target) ?? movies[0];
      }
      matchedTmdb = Boolean(top);
    }

    // Fallback: the most popular in-cinema title. Caption switches accordingly
    // so a popularity pick is never labelled as the box-office #1.
    if (!top) {
      source = "popular";
      top = [...playing].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];
    }

    if (!top) {
      logHealth({ ...FAILED, boxOfficeTitle });
      return { ...FAILED, boxOfficeTitle };
    }

    // Prefer a wide backdrop; fall back to the leader's own poster so the image
    // and the credit always refer to the same film.
    const image = backdropUrl(top.backdrop_path) ?? posterUrl(top.poster_path);
    const name = top.title ?? top.name ?? "Untitled";
    const date = top.release_date ?? top.first_air_date ?? null;
    const mediaType = top.media_type === "tv" ? "tv" : "movie";
    const result: HeroResolution = {
      ok: Boolean(image),
      source,
      title: name,
      image,
      href: image ? `/title/${mediaType}/${top.id}-${titleSlug(name, date)}` : null,
      boxOfficeTitle,
      matchedTmdb,
    };
    logHealth(result);
    return result;
  } catch {
    const result = { ...FAILED, boxOfficeTitle };
    logHealth(result);
    return result;
  }
}

/** One-line health log (visible in server/Vercel logs) emitted on each resolve. */
function logHealth(r: HeroResolution) {
  console.log(
    `[box-office-hero] source=${r.source} bo=${JSON.stringify(r.boxOfficeTitle)} matched=${r.matchedTmdb} ok=${r.ok} title=${JSON.stringify(r.title)}`,
  );
}
