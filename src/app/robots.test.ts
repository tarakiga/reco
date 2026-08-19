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
