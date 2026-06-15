import type { EpgEntry } from "@/services/epg";

// Minimal RFC 5545 iCalendar builder for the personal EPG feed. All-day events
// (TMDB gives a date, not a time) with a reminder, so calendar apps fire the alert.

const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const toDate = (ymd: string) => ymd.replace(/-/g, ""); // 2026-06-20 -> 20260620

const nextDay = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};

const code = (s: number, e: number) =>
  `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}`;

/** Build a subscribable .ics calendar from EPG entries. `now` is the DTSTAMP
 *  (YYYYMMDDTHHMMSSZ). */
export function buildEpgIcs(entries: EpgEntry[], opts: { name: string; now: string }): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Haystackk//EPG//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const e of entries) {
    const c = code(e.seasonNumber, e.episodeNumber);
    const summary = `${e.showTitle} — ${c}${e.episodeName ? `: ${e.episodeName}` : ""}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:tv-${e.tvId}-s${e.seasonNumber}e${e.episodeNumber}@haystackk.com`,
      `DTSTAMP:${opts.now}`,
      `DTSTART;VALUE=DATE:${toDate(e.airDate)}`,
      `DTEND;VALUE=DATE:${nextDay(e.airDate)}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(`New episode of ${e.showTitle}.`)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(summary)}`,
      "TRIGGER:-PT12H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
