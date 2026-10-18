import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { CardKeys } from "@/lib/card-keys";
import { useCardKeys } from "./useCardKeys";
import { useToggleFavourite } from "./useTitleState";

const auth = vi.hoisted(() => ({
  current: { isLoaded: false, isSignedIn: false, userId: null as string | null },
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => auth.current,
}));

function keysFor(favourites: string[]): CardKeys {
  return { signedIn: true, favourites, watchlist: [], watched: [] };
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("reports loading and does not fetch while Clerk is not loaded", () => {
  auth.current = { isLoaded: false, isSignedIn: false, userId: null };
  const { result } = renderHook(() => useCardKeys(), { wrapper: wrapper() });
  expect(result.current.status).toBe("loading");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("reports anonymous and never fetches when signed out", async () => {
  auth.current = { isLoaded: true, isSignedIn: false, userId: null };
  const { result } = renderHook(() => useCardKeys(), { wrapper: wrapper() });
  expect(result.current.status).toBe("anonymous");
  expect(result.current.has("favourites", "movie:603")).toBe(false);
  await new Promise((r) => setTimeout(r, 20));
  expect(fetchMock).not.toHaveBeenCalled();
});

test("fetches once per provider for a signed-in user and reports the keys", async () => {
  auth.current = { isLoaded: true, isSignedIn: true, userId: "user_a" };
  fetchMock.mockResolvedValue(new Response(JSON.stringify(keysFor(["movie:603"]))));
  const Wrapper = wrapper();
  const { result } = renderHook(
    () => ({ a: useCardKeys(), b: useCardKeys() }),
    { wrapper: Wrapper },
  );
  expect(result.current.a.status).toBe("loading");
  await waitFor(() => expect(result.current.a.status).toBe("ready"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/me/card-keys");
  expect(result.current.a.has("favourites", "movie:603")).toBe(true);
  expect(result.current.b.has("favourites", "movie:603")).toBe(true);
  expect(result.current.a.has("favourites", "movie:604")).toBe(false);
});

test("a failed card-keys read reports ready with no marks, so buttons stay usable", async () => {
  auth.current = { isLoaded: true, isSignedIn: true, userId: "user_a" };
  fetchMock.mockRejectedValue(new TypeError("network down"));
  const { result } = renderHook(() => useCardKeys(), { wrapper: wrapper() });
  expect(result.current.status).toBe("loading");
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.has("favourites", "movie:603")).toBe(false);
  expect(result.current.has("watchlist", "tv:1396")).toBe(false);
});

test("a later successful refetch replaces the empty fallback with the real marks", async () => {
  auth.current = { isLoaded: true, isSignedIn: true, userId: "user_a" };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
  const { result } = renderHook(() => useCardKeys(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.has("favourites", "movie:603")).toBe(false);

  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(keysFor(["movie:603"]))));
  await act(() => client.invalidateQueries({ queryKey: ["me", "card-keys"] }));
  await waitFor(() => expect(result.current.has("favourites", "movie:603")).toBe(true));
});

test("setKey updates the keys locally without another fetch", async () => {
  auth.current = { isLoaded: true, isSignedIn: true, userId: "user_a" };
  fetchMock.mockResolvedValue(new Response(JSON.stringify(keysFor([]))));
  const { result } = renderHook(() => useCardKeys(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.has("watchlist", "tv:1396")).toBe(false);

  act(() => result.current.setKey("watchlist", "tv:1396", true));
  await waitFor(() => expect(result.current.has("watchlist", "tv:1396")).toBe(true));

  act(() => result.current.setKey("watchlist", "tv:1396", false));
  await waitFor(() => expect(result.current.has("watchlist", "tv:1396")).toBe(false));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("switching accounts refetches and never shows the previous account's keys", async () => {
  auth.current = { isLoaded: true, isSignedIn: true, userId: "user_a" };
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(keysFor(["movie:603"]))));
  const { result, rerender } = renderHook(() => useCardKeys(), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.has("favourites", "movie:603")).toBe(true));

  let resolveB: (r: Response) => void = () => {};
  fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolveB = r)));
  auth.current = { isLoaded: true, isSignedIn: true, userId: "user_b" };
  rerender();

  expect(result.current.status).toBe("loading");
  expect(result.current.has("favourites", "movie:603")).toBe(false);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

  resolveB(new Response(JSON.stringify(keysFor(["tv:1396"]))));
  await waitFor(() => expect(result.current.status).toBe("ready"));
  expect(result.current.has("favourites", "tv:1396")).toBe(true);
  expect(result.current.has("favourites", "movie:603")).toBe(false);
});

/**
 * A fake server for overlapping card toggles. Favourite writes stay pending
 * until the test releases them; a card-keys read answers with what is committed
 * when it arrives, and can be held to simulate a slow refetch.
 */
function fakeServer() {
  const committed = new Set<string>();
  const writes: Array<() => void> = [];
  const heldReads: Array<() => void> = [];
  const server = { writes, heldReads, holdReads: false, reads: 0 };
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/v1/me/card-keys") {
      server.reads++;
      const res = new Response(JSON.stringify(keysFor([...committed])));
      if (!server.holdReads) return res;
      return new Promise<Response>((resolve) => heldReads.push(() => resolve(res)));
    }
    const body = JSON.parse(String(init?.body)) as { mediaType: string; tmdbId: number };
    const key = `${body.mediaType}:${body.tmdbId}`;
    return new Promise<Response>((resolve) =>
      writes.push(() => {
        if (init?.method === "PUT") committed.add(key);
        else committed.delete(key);
        resolve(new Response("{}"));
      }),
    );
  });
  return server;
}

const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 30)));

test("finishing one card write does not wipe another card's pending mark", async () => {
  auth.current = { isLoaded: true, isSignedIn: true, userId: "user_a" };
  const server = fakeServer();
  const { result } = renderHook(
    () => ({
      keys: useCardKeys(),
      favA: useToggleFavourite("movie", 1),
      favB: useToggleFavourite("movie", 2),
    }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.keys.status).toBe("ready"));

  // Heart A, then heart B while A's write is still pending.
  act(() => {
    result.current.keys.setKey("favourites", "movie:1", true);
    result.current.favA.mutate(true);
  });
  act(() => {
    result.current.keys.setKey("favourites", "movie:2", true);
    result.current.favB.mutate(true);
  });
  await waitFor(() => expect(server.writes).toHaveLength(2));

  // A's write lands first. Its success must not refetch while B is in flight.
  act(() => server.writes[0]());
  await waitFor(() => expect(result.current.favA.isSuccess).toBe(true));
  await settle();
  expect(result.current.keys.has("favourites", "movie:2")).toBe(true);
  expect(result.current.keys.has("favourites", "movie:1")).toBe(true);
  expect(server.reads).toBe(1);

  // B's write lands last; now the keys are refetched once and agree.
  act(() => server.writes[1]());
  await waitFor(() => expect(server.reads).toBe(2));
  await settle();
  expect(result.current.keys.has("favourites", "movie:1")).toBe(true);
  expect(result.current.keys.has("favourites", "movie:2")).toBe(true);
});

test("a refetch in flight cannot undo a newer toggle on the same card", async () => {
  auth.current = { isLoaded: true, isSignedIn: true, userId: "user_a" };
  const server = fakeServer();
  const { result } = renderHook(
    () => ({ keys: useCardKeys(), fav: useToggleFavourite("movie", 1) }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.keys.status).toBe("ready"));

  // Heart: the write succeeds and triggers a refetch that we hold open. The
  // held response already says "movie:1 is favourited".
  act(() => {
    result.current.keys.setKey("favourites", "movie:1", true);
    result.current.fav.mutate(true);
  });
  await waitFor(() => expect(server.writes).toHaveLength(1));
  server.holdReads = true;
  act(() => server.writes[0]());
  await waitFor(() => expect(server.heldReads).toHaveLength(1));

  // Unheart before that refetch returns.
  act(() => {
    result.current.keys.setKey("favourites", "movie:1", false);
    result.current.fav.mutate(false);
  });
  await waitFor(() => expect(server.writes).toHaveLength(2));
  expect(result.current.keys.has("favourites", "movie:1")).toBe(false);

  // The stale refetch returns; the newer "off" must stick.
  act(() => server.heldReads[0]());
  await settle();
  expect(result.current.keys.has("favourites", "movie:1")).toBe(false);

  // The unheart lands and the follow-up refetch confirms it.
  server.holdReads = false;
  act(() => server.writes[1]());
  await waitFor(() => expect(server.reads).toBe(3));
  await settle();
  expect(result.current.keys.has("favourites", "movie:1")).toBe(false);
});
