import { test, expect } from "vitest";
import robots from "./robots";

test("keeps episode pages out of crawler paths", () => {
  const rule = robots().rules;
  const catchAll = (Array.isArray(rule) ? rule : [rule]).find((r) => r.userAgent === "*");
  const disallow = catchAll?.disallow;
  expect(Array.isArray(disallow) ? disallow : [disallow]).toContain("/title/*/*/s*e*");
});

test("still disallows the search result pages", () => {
  const rule = robots().rules;
  const catchAll = (Array.isArray(rule) ? rule : [rule]).find((r) => r.userAgent === "*");
  const disallow = (Array.isArray(catchAll?.disallow) ? catchAll.disallow : []) as string[];
  expect(disallow).toContain("/find");
  expect(disallow).toContain("/rank");
});

test("lets link unfurlers fetch episode pages so share cards render", () => {
  const rules = robots().rules;
  const list = Array.isArray(rules) ? rules : [rules];
  const unfurlers = list.find((r) =>
    Array.isArray(r.userAgent) ? r.userAgent.includes("Twitterbot") : r.userAgent === "Twitterbot",
  );
  expect(unfurlers).toBeDefined();
  const disallow = (Array.isArray(unfurlers?.disallow) ? unfurlers.disallow : []) as string[];
  expect(disallow).not.toContain("/title/*/*/s*e*");
  expect(disallow).toContain("/api");
});
