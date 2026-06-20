import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { toBrowseResults } from "@/lib/tmdb/discover";
import { estimatedVodYmd, shiftYmd, VOD_WINDOW_DAYS } from "@/lib/release";
import type { TitleResult } from "@/lib/tmdb/transform";

export type ReleaseFilter = "all" | "theaters" | "streaming";

// TMDB release_dates types: 1 Premiere · 2 Theatrical (limited) · 3 Theatrical · 4 Digital · 5 Physical · 6 TV
const RELEASE_TYPES: Record<ReleaseFilter, string | null> = {
  all: null,
  theaters: "2|3",
  streaming: "4",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]}, ${MONTHS[m - 1]} ${d}`;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  label: string;
  items: TitleResult[];
}

/**
 * Upcoming movie releases in a region over the next `weeks`, grouped by day.
 * Fetched by popularity (so the notable releases surface) then re-sorted into a
 * chronological agenda. `todayYmd` is passed in so the cache key is deterministic.
 */
export async function getReleaseCalendar(
  region: string,
  filter: ReleaseFilter,
  todayYmd: string,
  weeks = 8,
): Promise<CalendarDay[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(`calendar:${region}:${filter}:${todayYmd}`);

  const end = shiftYmd(todayYmd, weeks * 7);
  // Use the region-scoped `release_date` window (NOT `primary_release_date`) so
  // that `with_release_type` actually constrains by that type's date in-region.
  // With `primary_release_date`, a movie surfaces on its primary date regardless
  // of the type filter — e.g. a film with only a theatrical date would still show
  // under "Streaming" on its primary date, implying a streaming release that
  // doesn't exist. `release_date` makes each tab show only its real releases and
  // groups them on the matched type's date.
  const base: Record<string, string> = {
    region,
    "release_date.gte": todayYmd,
    "release_date.lte": end,
    sort_by: "popularity.desc",
    include_adult: "false",
  };
  const type = RELEASE_TYPES[filter];
  if (type) base.with_release_type = type;

  const seen = new Set<number>();
  const items: TitleResult[] = [];
  for (let page = 1; page <= 3; page++) {
    const data = await tmdb.discover("movie", { ...base, page: String(page) }).catch(() => null);
    if (!data) break;
    for (const r of toBrowseResults("movie", data.results)) {
      if (seen.has(r.tmdbId)) continue;
      if (!r.releaseDate || r.releaseDate < todayYmd || r.releaseDate > end) continue;
      seen.add(r.tmdbId);
      items.push(r);
    }
    if (page >= (data.total_pages ?? 1)) break;
  }

  if (filter === "streaming") {
    await addEstimatedVod(items, seen, region, todayYmd, end);
  }

  const byDay = new Map<string, TitleResult[]>();
  for (const it of items) {
    const day = it.releaseDate!.slice(0, 10);
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(it);
  }
  return [...byDay.keys()]
    .sort()
    .map((date) => ({ date, label: dayLabel(date), items: byDay.get(date)! }));
}

/**
 * Fill the streaming agenda's coverage gap: many films get a theatrical date in
 * TMDB long before anyone logs the digital/VOD date. We pull recent wide
 * theatrical releases whose estimated VOD (theatrical + window) falls in the
 * agenda window, then add any not already present as `estimated` entries placed
 * on their projected date. Mutates `items`/`seen` in place.
 *
 * Note: discover is popularity-sorted, so only films notable enough to surface
 * in the first pages get a projection — very obscure titles still won't appear
 * until TMDB has a real digital date. That's intentional: the calendar is a
 * notable-releases view, not an exhaustive index.
 */
async function addEstimatedVod(
  items: TitleResult[],
  seen: Set<number>,
  region: string,
  todayYmd: string,
  end: string,
): Promise<void> {
  // An estimate lands in [today, end] iff the theatrical date is in
  // [today - window, end - window].
  const thFrom = shiftYmd(todayYmd, -VOD_WINDOW_DAYS);
  const thTo = shiftYmd(end, -VOD_WINDOW_DAYS);
  for (let page = 1; page <= 2; page++) {
    const data = await tmdb
      .discover("movie", {
        region,
        with_release_type: "3", // wide theatrical only — skips festival/limited noise
        "release_date.gte": thFrom,
        "release_date.lte": thTo,
        sort_by: "popularity.desc",
        include_adult: "false",
        page: String(page),
      })
      .catch(() => null);
    if (!data) break;
    for (const r of toBrowseResults("movie", data.results)) {
      if (seen.has(r.tmdbId) || !r.releaseDate) continue; // already has a confirmed date in-window
      const est = estimatedVodYmd(r.releaseDate);
      if (est < todayYmd || est > end) continue;
      seen.add(r.tmdbId);
      items.push({ ...r, releaseDate: est, estimated: true });
    }
    if (page >= (data.total_pages ?? 1)) break;
  }
}

/**
 * Movies that recently hit subscription (flatrate) streaming in a region — a
 * digital release in the last ~45 days that is currently available to stream.
 * The honest, TMDB-supported take on "newly added" (no expiry/leaving data exists).
 */
export async function getNewToStreaming(region: string, todayYmd: string): Promise<TitleResult[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(`new-streaming:${region}:${todayYmd}`);

  const data = await tmdb
    .discover("movie", {
      watch_region: region,
      region,
      with_watch_monetization_types: "flatrate",
      with_release_type: "4",
      "release_date.gte": shiftYmd(todayYmd, -45),
      "release_date.lte": todayYmd,
      sort_by: "popularity.desc",
      "vote_count.gte": "10",
      include_adult: "false",
    })
    .catch(() => null);
  if (!data) return [];
  return toBrowseResults("movie", data.results).slice(0, 20);
}
