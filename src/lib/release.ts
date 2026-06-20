const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Typical theatrical -> digital (VOD) window, in days. Used to estimate a VOD
 * date when TMDB has a theatrical date but no confirmed digital release yet
 * (a common data gap for smaller films). Modern PVOD windows cluster around
 * ~18 days, which is also what release-tracking sites tend to assume.
 */
export const VOD_WINDOW_DAYS = 18;

/** Shift a YYYY-MM-DD by N days, deterministically (UTC, no Date.now). */
export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Estimated VOD date (YYYY-MM-DD) from a theatrical date: theatrical + window. */
export function estimatedVodYmd(theatricalYmd: string): string {
  return shiftYmd(theatricalYmd, VOD_WINDOW_DAYS);
}

/**
 * Short "release date" label (e.g. "Aug 15, 2026") when the date is in the
 * future, otherwise null. Parses the YYYY-MM-DD components directly so there's
 * no timezone off-by-one, and compares on calendar date.
 */
export function upcomingLabel(releaseDate: string | null | undefined, now: Date = new Date()): string | null {
  if (!releaseDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(releaseDate);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  const release = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (release.getTime() <= today.getTime()) return null;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}
