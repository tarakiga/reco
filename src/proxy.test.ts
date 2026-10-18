// @vitest-environment node
import { test, expect, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

// Only the static `config` is under test; keep Clerk from initialising.
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: () => () => undefined }));

const { config } = await import("./proxy");

function runs(path: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url: `https://haystackk.com${path}` });
}

test.each([
  "/account",
  "/account/settings",
  "/watchlist",
  "/wrapped",
  "/calendar",
  "/vote/abc",
  "/tags/noir",
  "/challenges",
  "/list/abc",
  "/api/v1/me/card-keys",
  "/api/cron/notify",
  "/trpc/x",
  "/sign-in",
  "/sign-up",
  "/admin",
  "/og",
  // Near misses of excluded paths still run the proxy.
  "/tvx",
  "/moodsx",
  "/finder",
  "/titles",
])("the proxy runs on %s", (path) => {
  expect(runs(path)).toBe(true);
});

test.each([
  "/",
  "/title/movie/603-the-matrix-1999",
  "/title/movie/603-the-matrix-1999/og",
  "/title/tv/1396-x/s1e1",
  "/title/tv/1396-x/s1e1/og",
  "/person/17419-x",
  "/location/Q1028",
  "/source/Q1985",
  "/mood/cozy",
  "/mood/cozy/tv",
  "/moods",
  "/privacy",
  "/what-can-i-do",
  "/guide",
  "/shuffle",
  "/for-you",
  "/rank",
  "/tv",
  "/movies",
  "/find",
  "/search",
  "/find?q=squid",
  // Existing static-file exclusions.
  "/_next/static/chunks/main.js",
  "/favicon.ico",
  "/icon.png",
])("the proxy stays off %s", (path) => {
  expect(runs(path)).toBe(false);
});
