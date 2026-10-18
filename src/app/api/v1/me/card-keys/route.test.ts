import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  listFavouriteKeys: vi.fn(),
  listWatchlistKeys: vi.fn(),
  watchedTitleKeys: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("@/services/profile", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/services/user-catalog", () => ({
  listFavouriteKeys: mocks.listFavouriteKeys,
  listWatchlistKeys: mocks.listWatchlistKeys,
}));
vi.mock("@/services/completion", () => ({ watchedTitleKeys: mocks.watchedTitleKeys }));

import { GET } from "./route";

describe("GET /api/v1/me/card-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty keys for anonymous visitors", async () => {
    mocks.getCurrentProfile.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      signedIn: false,
      favourites: [],
      watchlist: [],
      watched: [],
    });
    expect(mocks.listFavouriteKeys).not.toHaveBeenCalled();
  });

  it("returns the user's keys when signed in", async () => {
    mocks.getCurrentProfile.mockResolvedValue({ id: "u1" });
    mocks.listFavouriteKeys.mockResolvedValue(["movie:603"]);
    mocks.listWatchlistKeys.mockResolvedValue(["tv:1396"]);
    mocks.watchedTitleKeys.mockResolvedValue(new Set(["movie:550"]));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      signedIn: true,
      favourites: ["movie:603"],
      watchlist: ["tv:1396"],
      watched: ["movie:550"],
    });
    expect(mocks.listFavouriteKeys).toHaveBeenCalledWith("u1");
  });
});
