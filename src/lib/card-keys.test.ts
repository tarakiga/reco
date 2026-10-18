import { describe, expect, it } from "vitest";
import { cardKey, EMPTY_CARD_KEYS, withCardKey } from "./card-keys";

describe("cardKey", () => {
  it("joins media type and tmdb id", () => {
    expect(cardKey("movie", 603)).toBe("movie:603");
    expect(cardKey("tv", 1396)).toBe("tv:1396");
  });
});

describe("withCardKey", () => {
  it("adds a key without mutating the input", () => {
    const next = withCardKey(EMPTY_CARD_KEYS, "favourites", "movie:603", true);
    expect(next.favourites).toEqual(["movie:603"]);
    expect(EMPTY_CARD_KEYS.favourites).toEqual([]);
    expect(next).not.toBe(EMPTY_CARD_KEYS);
  });

  it("never duplicates a key already present", () => {
    const once = withCardKey(EMPTY_CARD_KEYS, "favourites", "movie:603", true);
    const twice = withCardKey(once, "favourites", "movie:603", true);
    expect(twice.favourites).toHaveLength(1);
  });

  it("removes only the given key", () => {
    const k = {
      ...EMPTY_CARD_KEYS,
      watchlist: ["tv:1396", "movie:603"],
      favourites: ["tv:1396"],
    };
    const next = withCardKey(k, "watchlist", "tv:1396", false);
    expect(next.watchlist).toEqual(["movie:603"]);
    expect(next.favourites).toEqual(["tv:1396"]);
  });

  it("removing an absent key is a no-op", () => {
    const next = withCardKey(EMPTY_CARD_KEYS, "watched", "movie:1", false);
    expect(next.watched).toEqual([]);
  });
});
