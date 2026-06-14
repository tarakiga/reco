const BASE = "https://image.tmdb.org/t/p";

function url(size: string, path: string | null | undefined): string | null {
  return path ? `${BASE}/${size}${path}` : null;
}
export const posterUrl = (p: string | null | undefined) => url("w500", p);
/** Tiny poster, used for fast client-side dominant-color sampling. */
export const posterUrlSmall = (p: string | null | undefined) => url("w154", p);
export const backdropUrl = (p: string | null | undefined) => url("w1280", p);
export const profileUrl = (p: string | null | undefined) => url("w185", p);
export const logoUrl = (p: string | null | undefined) => url("w92", p);
/** Episode still image. */
export const stillUrl = (p: string | null | undefined) => url("w300", p);
