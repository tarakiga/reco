import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { CardKeys } from "@/lib/card-keys";
import { useCardKeys } from "./useCardKeys";

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
