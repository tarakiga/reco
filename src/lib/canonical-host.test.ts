import { test, expect } from "vitest";
import { canonicalRedirectUrl, type CanonicalInput } from "./canonical-host";

const base: CanonicalInput = {
  host: "reco-pink.vercel.app",
  pathname: "/find",
  search: "?q=squid",
  canonicalHost: "www.haystackk.com",
  isProduction: true,
};

test("redirects a non-canonical production host, keeping path and query", () => {
  expect(canonicalRedirectUrl(base)).toBe("https://www.haystackk.com/find?q=squid");
});

test("leaves the canonical host alone", () => {
  expect(canonicalRedirectUrl({ ...base, host: "www.haystackk.com" })).toBeNull();
});

test("leaves preview and local traffic alone", () => {
  expect(canonicalRedirectUrl({ ...base, isProduction: false })).toBeNull();
});

test("does nothing when no canonical host is configured", () => {
  expect(canonicalRedirectUrl({ ...base, canonicalHost: null })).toBeNull();
  expect(canonicalRedirectUrl({ ...base, canonicalHost: "" })).toBeNull();
});

test("does nothing without a host header", () => {
  expect(canonicalRedirectUrl({ ...base, host: null })).toBeNull();
  expect(canonicalRedirectUrl({ ...base, host: "" })).toBeNull();
});

test("exempts API routes so cron keeps its Authorization header", () => {
  expect(canonicalRedirectUrl({ ...base, pathname: "/api/cron/notify", search: "" })).toBeNull();
  expect(canonicalRedirectUrl({ ...base, pathname: "/api/v1/search", search: "?q=x" })).toBeNull();
  expect(canonicalRedirectUrl({ ...base, pathname: "/api", search: "" })).toBeNull();
});

test("does not exempt paths that merely start with the letters api", () => {
  expect(canonicalRedirectUrl({ ...base, pathname: "/apixyz", search: "" })).toBe(
    "https://www.haystackk.com/apixyz",
  );
});

test("redirects the bare root", () => {
  expect(canonicalRedirectUrl({ ...base, pathname: "/", search: "" })).toBe(
    "https://www.haystackk.com/",
  );
});

test("redirects the other auto-generated hosts", () => {
  for (const host of [
    "reco-tars-projects-8492f88e.vercel.app",
    "reco-git-main-tars-projects-8492f88e.vercel.app",
    "haystackk.com",
  ]) {
    expect(canonicalRedirectUrl({ ...base, host, pathname: "/", search: "" })).toBe(
      "https://www.haystackk.com/",
    );
  }
});
