// Client-safe mapping of a TMDB TV `status` to a card badge. Only terminal
// states get a badge — ongoing/returning shows stay unbadged so the grid stays clean.

export interface StatusBadge {
  label: string;
  tone: "neutral" | "danger";
}

export function statusBadge(status: string | null | undefined): StatusBadge | null {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  if (s === "ended") return { label: "Ended", tone: "neutral" };
  if (s === "canceled" || s === "cancelled") return { label: "Cancelled", tone: "danger" };
  return null;
}

/** The widened shape of the daily-cached tvAiring call, defined here (client-safe
 *  and pure) so the label logic is testable without the service. */
export interface TvAiringInfo {
  status: string | null;
  nextEpisode: {
    seasonNumber: number;
    episodeNumber: number;
    name: string | null;
    airDate: string | null;
  } | null;
  lastAirDate: string | null;
}

export interface AiringLabel {
  kind: "next-episode" | "returning" | "ended" | "cancelled" | "in-production";
  /** "Today", "Tomorrow", a weekday inside 7 days, or "27 Aug". Only for next-episode. */
  when: string | null;
}

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse a strict YYYY-MM-DD as UTC midnight, null otherwise. Date.parse alone
 *  accepts too much ("not-a-date" pieces, bare years), so validate the shape. */
function ymdToUtc(ymd: string | null): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const t = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  // Date.parse normalises out-of-range days ("2026-02-30" becomes 2 Mar) rather
  // than failing, so only a value that survives the round trip is a real date.
  return new Date(t).toISOString().slice(0, 10) === ymd ? t : null;
}

/**
 * The banner's display decision, pure so every date boundary is unit-testable.
 * todayYmd is resolved at the request boundary by the caller, never from a clock
 * here: render purity, and the server and client must agree on what "today" is.
 */
export function airingLabel(info: TvAiringInfo, todayYmd: string): AiringLabel | null {
  // A valid future next episode wins regardless of status: a show cancelled or
  // ended mid-run can still have episodes left to air, and the date is what a
  // viewer wants there, not a bare "Cancelled".
  const today = ymdToUtc(todayYmd);
  const air = ymdToUtc(info.nextEpisode?.airDate ?? null);
  if (info.nextEpisode && today != null && air != null && air >= today) {
    const days = Math.round((air - today) / DAY_MS);
    const when =
      days === 0
        ? "Today"
        : days === 1
          ? "Tomorrow"
          : days < 7
            ? WEEKDAYS[new Date(air).getUTCDay()]
            : `${new Date(air).getUTCDate()} ${MONTHS[new Date(air).getUTCMonth()]}`;
    return { kind: "next-episode", when };
  }

  const badge = statusBadge(info.status);
  if (badge) return { kind: badge.label === "Ended" ? "ended" : "cancelled", when: null };

  const s = info.status?.trim().toLowerCase() ?? null;
  const returning = s === "returning series";
  if (returning) return { kind: "returning", when: null };
  // Unmapped pre-release statuses ("In Production", "Pilot", "Planned"): only
  // worth a line when nothing has aired yet; on an airing show they are noise.
  if (s && info.lastAirDate == null) return { kind: "in-production", when: null };
  return null;
}
