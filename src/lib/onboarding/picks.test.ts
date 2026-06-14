import { blendPicks } from "./picks";
import type { TmdbSearchItem } from "@/lib/tmdb/types";

const movie = (id: number, title: string): TmdbSearchItem => ({ id, media_type: "movie", title, release_date: "2016-01-01", poster_path: "/p.jpg" });
const tv = (id: number, name: string): TmdbSearchItem => ({ id, media_type: "tv", name, first_air_date: "2018-01-01", poster_path: "/q.jpg" });

test("blendPicks interleaves movie/tv, dedupes, drops excluded", () => {
  const out = blendPicks([movie(1, "A"), movie(2, "B")], [tv(3, "C")], { exclude: new Set(["movie:2"]) });
  expect(out.map((p) => `${p.mediaType}:${p.tmdbId}`)).toEqual(["movie:1", "tv:3"]);
  expect(out[0]).toMatchObject({ title: "A", year: 2016, mediaType: "movie" });
  expect(out[0].posterUrl).toContain("/p.jpg");
});
