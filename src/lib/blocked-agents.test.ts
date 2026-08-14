import { test, expect } from "vitest";
import { isBlockedAgent } from "./blocked-agents";

test("blocks the Lightpanda crawler", () => {
  expect(isBlockedAgent("Lightpanda/1.0")).toBe(true);
  expect(isBlockedAgent("Mozilla/5.0 (compatible; Lightpanda/1.0)")).toBe(true);
});

test("matches case-insensitively", () => {
  expect(isBlockedAgent("lightpanda/1.0")).toBe(true);
});

test("leaves real browsers alone", () => {
  const chrome =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  const safari =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  expect(isBlockedAgent(chrome)).toBe(false);
  expect(isBlockedAgent(safari)).toBe(false);
});

test("leaves search engines alone", () => {
  expect(isBlockedAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(
    false,
  );
  expect(isBlockedAgent("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(
    false,
  );
});

test("does not match the name inside a longer word", () => {
  expect(isBlockedAgent("NotLightpandaish/1.0")).toBe(false);
});

test("tolerates a missing user agent", () => {
  expect(isBlockedAgent(null)).toBe(false);
  expect(isBlockedAgent(undefined)).toBe(false);
  expect(isBlockedAgent("")).toBe(false);
});
