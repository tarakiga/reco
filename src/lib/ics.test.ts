import { buildEpgIcs } from "./ics";
import type { EpgEntry } from "@/services/epg";

const entry = (over: Partial<EpgEntry>): EpgEntry => ({
  tvId: 1396,
  showTitle: "Breaking Bad",
  posterUrl: null,
  href: "/title/tv/1396-breaking-bad",
  seasonNumber: 5,
  episodeNumber: 9,
  episodeName: "Blood Money",
  airDate: "2026-06-20",
  ...over,
});

test("builds a valid VCALENDAR with one all-day VEVENT + alarm", () => {
  const ics = buildEpgIcs([entry({})], { name: "My EPG", now: "20260615T120000Z" });
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("END:VCALENDAR");
  expect(ics).toContain("DTSTART;VALUE=DATE:20260620");
  expect(ics).toContain("DTEND;VALUE=DATE:20260621"); // exclusive end = next day
  expect(ics).toContain("SUMMARY:Breaking Bad — S05E09: Blood Money");
  expect(ics).toContain("UID:tv-1396-s5e9@haystackk.com");
  expect(ics).toContain("BEGIN:VALARM");
  expect(ics.endsWith("\r\n")).toBe(true);
});

test("escapes commas/semicolons and omits the episode name when absent", () => {
  const ics = buildEpgIcs([entry({ episodeName: null, showTitle: "Boardwalk, Empire" })], {
    name: "My EPG",
    now: "20260615T120000Z",
  });
  expect(ics).toContain("SUMMARY:Boardwalk\\, Empire — S05E09");
  expect(ics).not.toContain(": null");
});
