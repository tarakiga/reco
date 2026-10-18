import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getOrCreateTitle: vi.fn(),
  getTitleState: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("@/services/profile", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/services/catalog", () => ({ getOrCreateTitle: mocks.getOrCreateTitle }));
vi.mock("@/services/user-catalog", () => ({ getTitleState: mocks.getTitleState }));

import { GET } from "./route";

const req = (qs: string) => new Request(`http://localhost/api/v1/me/title-state?${qs}`);

describe("GET /api/v1/me/title-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the persisted title id for a signed-in user", async () => {
    mocks.getCurrentProfile.mockResolvedValue({ id: "u1" });
    mocks.getOrCreateTitle.mockResolvedValue({ id: "row-1" });
    mocks.getTitleState.mockResolvedValue({ status: "watched", score: 8, favourite: true });
    const res = await GET(req("mediaType=movie&tmdbId=603"));
    expect(await res.json()).toEqual({
      status: "watched",
      score: 8,
      favourite: true,
      signedIn: true,
      titleId: "row-1",
    });
    expect(mocks.getOrCreateTitle).toHaveBeenCalledWith("movie", 603);
    expect(mocks.getTitleState).toHaveBeenCalledWith("u1", "row-1");
  });

  it("returns no title id for anonymous visitors", async () => {
    mocks.getCurrentProfile.mockResolvedValue(null);
    const body = await (await GET(req("mediaType=movie&tmdbId=603"))).json();
    expect(body.signedIn).toBe(false);
    expect(body).not.toHaveProperty("titleId");
    expect(mocks.getOrCreateTitle).not.toHaveBeenCalled();
  });
});
