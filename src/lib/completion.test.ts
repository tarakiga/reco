import { describe, it, expect } from "vitest";
import { progressFor, releasedItems, type CompletionItem } from "./completion";

function item(tmdbId: number, releaseDate: string | null): CompletionItem {
  return {
    key: `movie:${tmdbId}`,
    mediaType: "movie",
    tmdbId,
    title: `Title ${tmdbId}`,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    releaseDate,
    posterUrl: null,
    href: `/title/movie/${tmdbId}`,
  };
}

describe("releasedItems", () => {
  it("keeps undated items and items dated on or before the given day", () => {
    const items = [item(1, null), item(2, "2026-10-17"), item(3, "2026-10-18")];
    expect(releasedItems(items, "2026-10-18").map((i) => i.tmdbId)).toEqual([1, 2, 3]);
  });

  it("drops items dated after the given day", () => {
    const items = [item(1, "2026-10-18"), item(2, "2026-10-19")];
    expect(releasedItems(items, "2026-10-18").map((i) => i.tmdbId)).toEqual([1]);
  });
});

describe("progressFor", () => {
  it("splits a set into seen and remaining against the watched keys", () => {
    const items = [item(1, "2000-01-01"), item(2, "2001-01-01")];
    const p = progressFor(items, new Set(["movie:1"]));
    expect(p.total).toBe(2);
    expect(p.watched).toBe(1);
    expect(p.seen.map((i) => i.tmdbId)).toEqual([1]);
    expect(p.remaining.map((i) => i.tmdbId)).toEqual([2]);
  });
});
