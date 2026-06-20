import type { GuideEntry } from "@/services/guide";

// Build "add to calendar" links for a guide programme: a Google Calendar event
// template (opens pre-filled, saves to the user's default calendar) and a
// universal .ics (Apple/Outlook). No server, no storage — instant and reliable.

const pad = (n: number) => String(n).padStart(2, "0");

/** ms -> iCalendar UTC stamp (YYYYMMDDTHHMMSSZ). */
function icsStamp(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export interface CalEvent {
  title: string;
  details: string;
  location: string;
  startMs: number;
  endMs: number;
  uid: string;
}

/** Calendar event for a programme, or null if it has no usable start time. */
export function calEvent(entry: GuideEntry, channel: string): CalEvent | null {
  if (!entry.airstamp) return null;
  const startMs = Date.parse(entry.airstamp);
  if (Number.isNaN(startMs)) return null;
  const endMs = startMs + (entry.runtime && entry.runtime > 0 ? entry.runtime : 60) * 60_000;

  const isTv = entry.season != null && entry.episode != null;
  const title = isTv ? `${entry.showName} S${entry.season}E${entry.episode}` : entry.showName;

  const parts: string[] = [];
  if (isTv && entry.episodeTitle) parts.push(entry.episodeTitle);
  if (entry.synopsis) parts.push(entry.synopsis);
  parts.push(`On ${channel}`);

  return {
    title,
    details: parts.join("\n\n"),
    location: `On ${channel}`,
    startMs,
    endMs,
    uid: `guide-${entry.id}@haystackk.com`,
  };
}

export function googleCalendarUrl(e: CalEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsStamp(e.startMs)}/${icsStamp(e.endMs)}`,
    details: e.details,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 line folding: split at 75 octets, continuation lines start with a space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length) {
    chunks.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

/** A single-event .ics with a 10-minute reminder alarm. */
export function icsForEvent(e: CalEvent, nowMs: number): string {
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Haystackk//Guide//EN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${icsStamp(nowMs)}`,
      `DTSTART:${icsStamp(e.startMs)}`,
      `DTEND:${icsStamp(e.endMs)}`,
      fold(`SUMMARY:${esc(e.title)}`),
      fold(`DESCRIPTION:${esc(e.details)}`),
      fold(`LOCATION:${esc(e.location)}`),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc(e.title)}`),
      "TRIGGER:-PT10M",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n"
  );
}
