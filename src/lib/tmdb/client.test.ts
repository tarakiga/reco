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

test("each attempt carries a 10 s timeout signal", async () => {
  const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
  const spy = vi.fn<typeof fetch>(() => Promise.resolve(new Response("{}", { status: 200 })));
  vi.stubGlobal("fetch", spy);
  await tmdb.tvAiring(1396);
  expect(timeoutSpy).toHaveBeenCalledWith(10_000);
  expect(spy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
});

test("a hung attempt is aborted and retried like any other transient failure", async () => {
  const realTimeout = AbortSignal.timeout.bind(AbortSignal);
  // Shrink the timeout so the test does not wait 10 s for the first attempt.
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(20));
  let calls = 0;
  const spy = vi.fn<typeof fetch>((_url, init) => {
    calls++;
    if (calls === 1) {
      // Hang until the signal fires, as a stalled connection would.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      });
    }
    return Promise.resolve(new Response(JSON.stringify({ id: 1396 }), { status: 200 }));
  });
  vi.stubGlobal("fetch", spy);
  await expect(tmdb.tvAiring(1396)).resolves.toEqual({ id: 1396 });
  expect(spy).toHaveBeenCalledTimes(2);
});

test("attempts that keep timing out end in a retryable TmdbError (503)", async () => {
  const spy = vi.fn<typeof fetch>(() =>
    Promise.reject(new DOMException("The operation was aborted due to timeout", "TimeoutError")),
  );
  vi.stubGlobal("fetch", spy);
  await expect(tmdb.tvAiring(1396)).rejects.toMatchObject({ status: 503 });
  expect(spy).toHaveBeenCalledTimes(4);
});
