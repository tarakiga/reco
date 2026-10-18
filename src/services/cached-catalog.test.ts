import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./catalog", () => ({
  getOrCreateTitle: vi.fn(),
  getOrCreatePerson: vi.fn(),
}));

import { getOrCreateTitle, getOrCreatePerson } from "./catalog";
import { cachedTitle, cachedPerson } from "./cached-catalog";
import { TmdbError } from "@/lib/tmdb/client";

const titleMock = vi.mocked(getOrCreateTitle);
const personMock = vi.mocked(getOrCreatePerson);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cachedTitle", () => {
  it("returns the row on success", async () => {
    const row = { tmdbId: 1 } as never;
    titleMock.mockResolvedValue(row);
    expect(await cachedTitle("movie", 1)).toBe(row);
  });

  it("returns null on a TMDB 404", async () => {
    titleMock.mockRejectedValue(new TmdbError(404, "x"));
    expect(await cachedTitle("movie", 1)).toBeNull();
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
  it("returns the row on success", async () => {
    const row = { tmdbId: 1 } as never;
    personMock.mockResolvedValue(row);
    expect(await cachedPerson(1)).toBe(row);
  });

  it("returns null on a TMDB 404", async () => {
    personMock.mockRejectedValue(new TmdbError(404, "x"));
    expect(await cachedPerson(1)).toBeNull();
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
