import { vi, beforeEach } from "vitest";
import { meFetch, MeApiError } from "./me-client";

beforeEach(() => {
  vi.restoreAllMocks();
});

test("returns parsed json on ok", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true, version: 3 }), { status: 200 })),
  );
  await expect(meFetch("/api/v1/me/watchlist", { method: "GET" })).resolves.toEqual({
    ok: true,
    version: 3,
  });
});

test("throws MeApiError with status and message on error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "Sign in required" }), { status: 401 })),
  );
  const err = await meFetch("/api/v1/me/watchlist").catch((e) => e);
  expect(err).toBeInstanceOf(MeApiError);
  expect(err).toMatchObject({
    status: 401,
    message: "Sign in required",
  });
});

test("sends JSON body and header", async () => {
  const spy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", spy);
  await meFetch("/api/v1/me/watchlist", { method: "PUT", body: { mediaType: "movie", tmdbId: 603, status: "watched" } });
  const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string>; body: string }];
  expect(init.method).toBe("PUT");
  expect(init.headers["Content-Type"]).toBe("application/json");
  expect(init.body).toBe(JSON.stringify({ mediaType: "movie", tmdbId: 603, status: "watched" }));
});
