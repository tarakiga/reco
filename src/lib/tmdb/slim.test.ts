import { slimTitleMetadata } from "./slim";
import type { TmdbTitleDetail } from "./types";

test("slimTitleMetadata caps cast, filters crew, strips recs, keeps key fields", () => {
  const meta: TmdbTitleDetail = {
    id: 1,
    title: "X",
    overview: "keep me",
    genres: [{ id: 1, name: "Drama" }],
    vote_average: 8,
    credits: {
      cast: Array.from({ length: 40 }, (_, i) => ({ id: i, name: `Actor ${i}`, order: i, character: "c" })),
      crew: [
        { id: 1, name: "Dir", job: "Director", department: "Directing" },
        { id: 2, name: "Grip", job: "Key Grip", department: "Camera" },
        { id: 3, name: "Wri", job: "Writer", department: "Writing" },
      ],
    },
    recommendations: {
      results: Array.from({ length: 30 }, (_, i) => ({
        id: i,
        media_type: "movie" as const,
        title: `Rec ${i}`,
        poster_path: "/p.jpg",
        overview: "long overview that should be dropped",
      })),
    },
    videos: {
      results: [
        { key: "yt1", site: "YouTube", type: "Trailer", official: true },
        { key: "vm1", site: "Vimeo", type: "Trailer" },
        { key: "yt2", site: "YouTube", type: "Featurette" },
      ],
    },
    release_dates: {
      results: [
        { iso_3166_1: "US", release_dates: [{ certification: "R" }] },
        { iso_3166_1: "ZZ", release_dates: [{ certification: "X" }] },
      ],
    },
    "watch/providers": {
      results: {
        US: { flatrate: [{ provider_id: 8, provider_name: "Netflix" }] },
        ZZ: { flatrate: [{ provider_id: 9, provider_name: "Obscure" }] },
      },
    },
  };

  const slim = slimTitleMetadata(meta);

  expect(slim.overview).toBe("keep me");
  expect(slim.genres).toEqual([{ id: 1, name: "Drama" }]);
  expect(slim.vote_average).toBe(8);
  expect(slim.credits!.cast).toHaveLength(20);
  expect(slim.credits!.crew!.map((c) => c.name)).toEqual(["Dir", "Wri"]); // Key Grip dropped
  expect(slim.recommendations!.results).toHaveLength(12);
  expect((slim.recommendations!.results![0] as { overview?: string }).overview).toBeUndefined();
  expect(slim.videos!.results!.map((v) => v.key)).toEqual(["yt1"]); // only YouTube trailer/teaser
  expect(slim.release_dates!.results!.map((r) => r.iso_3166_1)).toEqual(["US"]); // ZZ dropped
  expect(Object.keys(slim["watch/providers"]!.results!)).toEqual(["US"]); // ZZ dropped
});
