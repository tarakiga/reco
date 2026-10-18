import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./catalog", () => ({
  getOrCreateTitle: vi.fn(),
  getOrCreatePerson: vi.fn(),
  STALE_MS: 1000 * 60 * 60 * 24 * 7,
}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { cacheLife } from "next/cache";
import { getOrCreateTitle, getOrCreatePerson } from "./catalog";
import { cachedTitle, cachedPerson } from "./cached-catalog";
import { TmdbError } from "@/lib/tmdb/client";

const titleMock = vi.mocked(getOrCreateTitle);
const personMock = vi.mocked(getOrCreatePerson);
const DAY = 1000 * 60 * 60 * 24;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cachedTitle", () => {
  it("returns the row on success", async () => {
    const row = { tmdbId: 1 } as never;
    titleMock.mockResolvedValue(row);
    expect(await cachedTitle("movie", 1)).toBe(row);
  });

  it("caches a fresh full row for days only", async () => {
    titleMock.mockResolvedValue({ tmdbId: 1, refreshedAt: new Date() } as never);
    await cachedTitle("movie", 1);
    expect(cacheLife).toHaveBeenCalledWith("days");
    expect(cacheLife).not.toHaveBeenCalledWith("hours");
  });

  it("caches the minimal TMDB-outage fallback row (refreshedAt epoch) for hours", async () => {
    titleMock.mockResolvedValue({ tmdbId: 1, refreshedAt: new Date(0) } as never);
    await cachedTitle("movie", 1);
    expect(cacheLife).toHaveBeenCalledWith("hours");
  });

  it("caches a stale reused row (older than the freshness window) for hours", async () => {
    titleMock.mockResolvedValue({ tmdbId: 1, refreshedAt: new Date(Date.now() - 8 * DAY) } as never);
    await cachedTitle("tv", 1);
    expect(cacheLife).toHaveBeenCalledWith("hours");
  });

  it("returns null on a TMDB 404, cached for hours", async () => {
    titleMock.mockRejectedValue(new TmdbError(404, "x"));
    expect(await cachedTitle("movie", 1)).toBeNull();
    expect(cacheLife).toHaveBeenCalledWith("hours");
  });

  it("rethrows a TMDB 503", async () => {
    titleMock.mockRejectedValue(new TmdbError(503, "x"));
    await expect(cachedTitle("tv", 1)).rejects.toMatchObject({ status: 503 });
  });

  it("rethrows a plain Error", async () => {
    titleMock.mockRejectedValue(new Error("boom"));
    await expect(cachedTitle("tv", 1)).rejects.toThrow("boom");
  });

  it("does not persist", async () => {
    titleMock.mockResolvedValue({} as never);
    await cachedTitle("tv", 7);
    expect(titleMock).toHaveBeenCalledWith("tv", 7, false);
  });
});

describe("cachedPerson", () => {
  it("returns the row on success, cached for days", async () => {
    const row = { tmdbId: 1 } as never;
    personMock.mockResolvedValue(row);
    expect(await cachedPerson(1)).toBe(row);
    expect(cacheLife).not.toHaveBeenCalledWith("hours");
  });

  it("returns null on a TMDB 404, cached for hours", async () => {
    personMock.mockRejectedValue(new TmdbError(404, "x"));
    expect(await cachedPerson(1)).toBeNull();
    expect(cacheLife).toHaveBeenCalledWith("hours");
  });

  it("rethrows a TMDB 503", async () => {
    personMock.mockRejectedValue(new TmdbError(503, "x"));
    await expect(cachedPerson(1)).rejects.toMatchObject({ status: 503 });
  });

  it("rethrows a plain Error", async () => {
    personMock.mockRejectedValue(new Error("boom"));
    await expect(cachedPerson(1)).rejects.toThrow("boom");
  });

  it("does not persist", async () => {
    personMock.mockResolvedValue({} as never);
    await cachedPerson(9);
    expect(personMock).toHaveBeenCalledWith(9, false);
  });
});
