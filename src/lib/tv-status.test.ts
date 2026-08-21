import { test, expect } from "vitest";
import { statusBadge, airingLabel, type TvAiringInfo } from "./tv-status";

const NEXT = { seasonNumber: 3, episodeNumber: 5, name: "The Heist", airDate: "2026-08-22" };
const info = (over: Partial<TvAiringInfo>): TvAiringInfo => ({
  status: "Returning Series",
  nextEpisode: null,
  lastAirDate: "2024-05-01",
  ...over,
});

test("statusBadge is unchanged", () => {
  expect(statusBadge("Ended")).toEqual({ label: "Ended", tone: "neutral" });
  expect(statusBadge("Returning Series")).toBeNull();
});

test("a scheduled episode today, tomorrow, this week, and beyond", () => {
  const at = (airDate: string) => airingLabel(info({ nextEpisode: { ...NEXT, airDate } }), "2026-08-20");
  expect(at("2026-08-20")).toMatchObject({ kind: "next-episode", when: "Today" });
  expect(at("2026-08-21")).toMatchObject({ kind: "next-episode", when: "Tomorrow" });
  expect(at("2026-08-22")).toMatchObject({ kind: "next-episode", when: "Saturday" });
  expect(at("2026-08-26")).toMatchObject({ kind: "next-episode", when: "Wednesday" });
  expect(at("2026-08-27")).toMatchObject({ kind: "next-episode", when: "27 Aug" });
});

test("a past or malformed air date degrades to returning", () => {
  expect(airingLabel(info({ nextEpisode: { ...NEXT, airDate: "2026-08-19" } }), "2026-08-20")?.kind).toBe("returning");
  expect(airingLabel(info({ nextEpisode: { ...NEXT, airDate: "not-a-date" } }), "2026-08-20")?.kind).toBe("returning");
  expect(airingLabel(info({ nextEpisode: { ...NEXT, airDate: null } }), "2026-08-20")?.kind).toBe("returning");
});

test("a well-shaped but invalid calendar date is rejected, not rolled over", () => {
  // Date.parse turns 2026-02-30 into 2026-03-02 rather than failing. With
  // today just before the rollover target, an unfixed parser would report
  // next-episode "2 Mar" for a date that does not exist.
  expect(airingLabel(info({ nextEpisode: { ...NEXT, airDate: "2026-02-30" } }), "2026-02-25")?.kind).toBe("returning");
});

test("returning with nothing scheduled", () => {
  expect(airingLabel(info({}), "2026-08-20")).toMatchObject({ kind: "returning", when: null });
});

test("ended and cancelled map to their kinds", () => {
  expect(airingLabel(info({ status: "Ended" }), "2026-08-20")?.kind).toBe("ended");
  expect(airingLabel(info({ status: "Canceled" }), "2026-08-20")?.kind).toBe("cancelled");
});

test("an unmapped status shows in-production only when nothing has aired", () => {
  expect(airingLabel(info({ status: "In Production", lastAirDate: null }), "2026-08-20")?.kind).toBe("in-production");
  expect(airingLabel(info({ status: "Pilot", lastAirDate: null }), "2026-08-20")?.kind).toBe("in-production");
  expect(airingLabel(info({ status: "In Production" }), "2026-08-20")).toBeNull();
  expect(airingLabel(info({ status: null }), "2026-08-20")).toBeNull();
});
