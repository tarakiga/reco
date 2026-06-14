import { vi, afterEach } from "vitest";
import { expandSceneQuery } from "./expand";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
});

test("returns the query unchanged when no API key is set", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  expect(await expandSceneQuery("girls in a dorm")).toBe("girls in a dorm");
});

test("appends the Haiku expansion when a key is present", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ text: "teenage girls living at a boarding school dormitory" }] }) })),
  );
  const r = await expandSceneQuery("girls in a dorm");
  expect(r).toContain("girls in a dorm");
  expect(r).toContain("boarding school");
});

test("falls back to the original query on API error", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
  expect(await expandSceneQuery("a heist gone wrong")).toBe("a heist gone wrong");
});
