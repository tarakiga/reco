import { vi, beforeEach } from "vitest";
import { tmdb, TmdbError } from "./client";

beforeEach(() => vi.restoreAllMocks());

function mockOnce(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

test("searchMulti hits /search/multi with query and api_key", async () => {
  const body = JSON.stringify({ results: [] });
  const spy = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(body, { status: 200 }))
  );
  vi.stubGlobal("fetch", spy);
  await tmdb.searchMulti("matrix");
  const calledUrl = String(spy.mock.calls[0][0]);
  expect(calledUrl).toContain("/search/multi");
  expect(calledUrl).toContain("query=matrix");
  expect(calledUrl).toContain("api_key=");
});

test("getTitle appends credits,videos,watch/providers", async () => {
  const body = JSON.stringify({ id: 1 });
  const spy = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(body, { status: 200 }))
  );
  vi.stubGlobal("fetch", spy);
  await tmdb.getTitle("movie", 603);
  const calledUrl = String(spy.mock.calls[0][0]);
  expect(calledUrl).toContain("/movie/603");
  expect(calledUrl).toContain("append_to_response=credits%2Cvideos%2Cwatch%2Fproviders");
});

test("throws TmdbError on non-ok", async () => {
  mockOnce(404, { status_message: "Not found" });
  await expect(tmdb.getTitle("movie", 999999999)).rejects.toBeInstanceOf(TmdbError);
});
