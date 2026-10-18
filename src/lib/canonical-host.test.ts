// @vitest-environment node
import { test, expect } from "vitest";
// Next's own redirect machinery, so the source and host patterns are checked
// exactly the way `next start` matches them (Vercel builds its routes from the
// same path-to-regexp output). These are internal modules: if a Next upgrade
// moves them, this file fails to import rather than passing silently.
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { matchHas, prepareDestination } from "next/dist/shared/lib/router/utils/prepare-destination";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { formatUrl } from "next/dist/shared/lib/router/utils/format-url";
import { checkCustomRoutes } from "next/dist/lib/load-custom-routes";
import { buildCustomRoute } from "next/dist/lib/build-custom-route";
import { canonicalRedirects } from "./canonical-host";

const production = { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "haystackk.com" };

function onlyRedirect() {
  const redirects = canonicalRedirects(production);
  expect(redirects).toHaveLength(1);
  return redirects[0];
}

/** Where Next would send `path` on `host`, or null when the redirect does not apply. */
function resolve(host: string, path: string): string | null {
  const r = onlyRedirect();
  const url = new URL(path, "http://x");
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams);
  // Same options Next's router uses for redirects (filesystem.ts), including the
  // `/_next` exclusion it adds to every redirect.
  const match = getPathMatch(r.source, {
    strict: true,
    removeUnnamedParams: true,
    regexModifier: (regex: string) => modifyRouteRegex(regex, ["/_next"]),
  });
  const params = match(pathname);
  if (!params) return null;
  const req = { headers: { host } } as unknown as Parameters<typeof matchHas>[0];
  const hasParams = matchHas(req, query, r.has, r.missing);
  if (!hasParams) return null;
  const { parsedDestination } = prepareDestination({
    appendParamsToQuery: false,
    destination: r.destination,
    params: { ...params, ...hasParams },
    query,
  });
  // As resolve-routes.ts does: the request's query rides along on the redirect.
  const { query: destQuery, ...rest } = parsedDestination;
  const search = new URLSearchParams(destQuery as Record<string, string>).toString();
  return formatUrl({ ...rest, search: search ? `?${search}` : "" });
}

test("no redirect outside Vercel", () => {
  expect(canonicalRedirects({})).toEqual([]);
});

test("no redirect on preview deployments", () => {
  expect(
    canonicalRedirects({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "haystackk.com" }),
  ).toEqual([]);
});

test("no redirect in production without a production host", () => {
  expect(canonicalRedirects({ VERCEL_ENV: "production" })).toEqual([]);
  expect(canonicalRedirects({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "" })).toEqual([]);
});

test("production gets one permanent redirect to the production host", () => {
  const r = onlyRedirect();
  expect(r.permanent).toBe(true);
  expect(r.destination.startsWith("https://haystackk.com/")).toBe(true);
});

test("passes the validation `next build` runs on redirects", () => {
  const redirects = canonicalRedirects(production);
  expect(() => checkCustomRoutes(redirects, "redirect")).not.toThrow();
  // The regex written to routes-manifest.json, which the platform serves from.
  const { regex } = buildCustomRoute("redirect", redirects[0], ["/_next"]);
  const re = new RegExp(regex, "i");
  expect(re.test("/find")).toBe(true);
  expect(re.test("/")).toBe(true);
  expect(re.test("/api/cron/x")).toBe(false);
  expect(re.test("/api")).toBe(false);
  expect(re.test("/_next/static/x.js")).toBe(false);
});

test("the host condition matches *.vercel.app and nothing else", () => {
  const r = onlyRedirect();
  const host = r.has?.find((h) => h.type === "host");
  expect(host).toBeDefined();
  // Next tests has-values as `^${value}$` (prepare-destination.ts).
  const re = new RegExp(`^${host!.value}$`);
  expect(re.test("reco-pink.vercel.app")).toBe(true);
  expect(re.test("reco-git-main-tars-projects-8492f88e.vercel.app")).toBe(true);
  expect(re.test("haystackk.com")).toBe(false);
  expect(re.test("www.haystackk.com")).toBe(false);
  expect(re.test("vercel.app")).toBe(false);
  expect(re.test("reco-pinkxvercelxapp")).toBe(false);
  expect(re.test("reco-pink.vercel.app.example.com")).toBe(false);
});

test("redirects a vercel.app host, keeping the path", () => {
  expect(resolve("reco-pink.vercel.app", "/find")).toBe("https://haystackk.com/find");
  expect(resolve("reco-pink.vercel.app", "/title/movie/603-the-matrix-1999")).toBe(
    "https://haystackk.com/title/movie/603-the-matrix-1999",
  );
  expect(resolve("reco-pink.vercel.app", "/apixyz")).toBe("https://haystackk.com/apixyz");
});

test("keeps the query string", () => {
  expect(resolve("reco-pink.vercel.app", "/find?q=squid")).toBe("https://haystackk.com/find?q=squid");
});

test("redirects the bare root", () => {
  expect(resolve("reco-pink.vercel.app", "/")).toBe("https://haystackk.com/");
});

test("leaves the production host alone", () => {
  expect(resolve("haystackk.com", "/find")).toBeNull();
  expect(resolve("haystackk.com", "/")).toBeNull();
});

test("exempts API routes so cron keeps its Authorization header", () => {
  expect(resolve("reco-pink.vercel.app", "/api/cron/x")).toBeNull();
  expect(resolve("reco-pink.vercel.app", "/api/v1/search")).toBeNull();
  expect(resolve("reco-pink.vercel.app", "/api")).toBeNull();
  expect(resolve("reco-pink.vercel.app", "/api/")).toBeNull();
});
