import { vi, test, expect, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/tmdb/client", () => ({ tmdb: { discover: vi.fn(), getPerson: vi.fn() } }));
// Deterministic suppression so the test does not depend on the real list.
vi.mock("@/lib/tmdb/suppressed", () => ({
  isSuppressedTitle: (_mt: "movie" | "tv", id: number) => id === 666,
}));

import { tmdb } from "@/lib/tmdb/client";
import { axisGroup } from "./title-axes";
import type { TitleAxis } from "@/lib/tmdb/axes";

const item = (id: number, title: string, popularity = 0) => ({
  id,
  title,
  poster_path: null,
  release_date: "2020-01-01",
  popularity,
});

beforeEach(() => {
  vi.clearAllMocks();
});

test("movie person axis queries discover with with_people and a vote floor", async () => {
  (tmdb.discover as Mock).mockResolvedValue({ results: [item(1, "A"), item(2, "B")] });
  const axis: TitleAxis = { kind: "person", personId: 138, label: "From director Quentin Tarantino" };
  const out = await axisGroup("movie", axis, 999);
  expect(tmdb.discover).toHaveBeenCalledWith("movie", {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": "200",
    with_people: "138",
  });
  expect(out.label).toBe("From director Quentin Tarantino");
  expect(out.items.map((i) => i.tmdbId)).toEqual([1, 2]);
});

test("keyword and genre axes pass their discover filters", async () => {
  (tmdb.discover as Mock).mockResolvedValue({ results: [] });
  await axisGroup("tv", { kind: "keyword", keywordId: 622, label: "More hitman" }, 1);
  expect(tmdb.discover).toHaveBeenLastCalledWith("tv", {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": "100",
    with_keywords: "622",
  });
  await axisGroup("movie", { kind: "genre", genreIds: [53, 80], label: "More thriller + crime" }, 1);
  expect(tmdb.discover).toHaveBeenLastCalledWith("movie", {
    sort_by: "popularity.desc",
    include_adult: "false",
    "vote_count.gte": "200",
    with_genres: "53,80",
  });
});

test("the source title is excluded and the group caps at 12", async () => {
  const results = Array.from({ length: 15 }, (_, i) => item(i + 1, `T${i + 1}`));
  (tmdb.discover as Mock).mockResolvedValue({ results });
  const out = await axisGroup("movie", { kind: "keyword", keywordId: 1, label: "More x" }, 3);
  expect(out.items).toHaveLength(12);
  expect(out.items.some((i) => i.tmdbId === 3)).toBe(false);
});

test("tv cast axis uses the person's combined credits, tv only, by popularity", async () => {
  (tmdb.getPerson as Mock).mockResolvedValue({
    id: 17419,
    name: "Bryan Cranston",
    combined_credits: {
      cast: [
        { ...item(1396, ""), name: "Breaking Bad", media_type: "tv", first_air_date: "2008-01-20", popularity: 300 },
        { ...item(2316, ""), name: "The Office", media_type: "tv", first_air_date: "2005-03-24", popularity: 500 },
        { ...item(680, "Pulp Fiction"), media_type: "movie", popularity: 900 },
      ],
    },
  });
  const axis: TitleAxis = { kind: "cast", personId: 17419, label: "Also starring Bryan Cranston" };
  const out = await axisGroup("tv", axis, 1);
  expect(tmdb.discover).not.toHaveBeenCalled();
  expect(out.items.map((i) => i.tmdbId)).toEqual([2316, 1396]);
});

test("tv maker axis prefers Creator crew credits and dedupes repeat shows", async () => {
  (tmdb.getPerson as Mock).mockResolvedValue({
    id: 66633,
    name: "Vince Gilligan",
    combined_credits: {
      crew: [
        { ...item(1396, ""), name: "Breaking Bad", media_type: "tv", job: "Creator", popularity: 300 },
        { ...item(1396, ""), name: "Breaking Bad", media_type: "tv", job: "Executive Producer", popularity: 300 },
        { ...item(60059, ""), name: "Better Call Saul", media_type: "tv", job: "Creator", popularity: 200 },
        { ...item(999, ""), name: "Some EP Gig", media_type: "tv", job: "Executive Producer", popularity: 900 },
      ],
    },
  });
  const axis: TitleAxis = { kind: "person", personId: 66633, label: "From creator Vince Gilligan" };
  const out = await axisGroup("tv", axis, 1);
  expect(out.items.map((i) => i.tmdbId)).toEqual([1396, 60059]);
});

test("suppressed titles never enter a group", async () => {
  (tmdb.discover as Mock).mockResolvedValue({ results: [item(1, "A"), item(666, "Nope"), item(2, "B")] });
  const out = await axisGroup("movie", { kind: "keyword", keywordId: 1, label: "More x" }, 99);
  expect(out.items.map((i) => i.tmdbId)).toEqual([1, 2]);
});

test("an upstream failure degrades to an empty group", async () => {
  (tmdb.discover as Mock).mockRejectedValue(new Error("tmdb down"));
  const out = await axisGroup("movie", { kind: "keyword", keywordId: 1, label: "More x" }, 1);
  expect(out).toEqual({ label: "More x", items: [] });
});
