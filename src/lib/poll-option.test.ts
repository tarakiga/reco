import { test, expect } from "vitest";
import { optionKey, parseOptionKey, isEpisode } from "./poll-option";

const UUID = "3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607";

test("a whole title round trips through 0:0", () => {
  const key = optionKey(UUID);
  expect(key).toBe(`${UUID}:0:0`);
  expect(parseOptionKey(key)).toEqual({ titleId: UUID, season: 0, episode: 0 });
  expect(isEpisode(key)).toBe(false);
});

test("an episode round trips", () => {
  const key = optionKey(UUID, 2, 5);
  expect(key).toBe(`${UUID}:2:5`);
  expect(parseOptionKey(key)).toEqual({ titleId: UUID, season: 2, episode: 5 });
  expect(isEpisode(key)).toBe(true);
});

test("parseOptionKey rejects malformed keys", () => {
  expect(parseOptionKey("")).toBeNull();
  expect(parseOptionKey(UUID)).toBeNull();
  expect(parseOptionKey(`${UUID}:1`)).toBeNull();
  expect(parseOptionKey(`${UUID}:a:1`)).toBeNull();
  expect(parseOptionKey(`${UUID}:1:2:3`)).toBeNull();
  expect(parseOptionKey(`${UUID}:-1:2`)).toBeNull();
});

test("isEpisode is false for anything unparseable", () => {
  expect(isEpisode("rubbish")).toBe(false);
});
