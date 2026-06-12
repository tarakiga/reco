import {
  upsertOptionInput,
  reorderInput,
  publishInput,
  rollbackInput,
  upsertBlockInput,
} from "./config";

test("accepts a valid option upsert", () => {
  const r = upsertOptionInput.safeParse({
    namespace: "nav",
    key: "home",
    label: "Home",
    value: { href: "/" },
  });
  expect(r.success).toBe(true);
});

test("rejects bad namespace characters and empty label", () => {
  expect(
    upsertOptionInput.safeParse({ namespace: "Bad Space", key: "k", label: "L" }).success,
  ).toBe(false);
  expect(
    upsertOptionInput.safeParse({ namespace: "nav", key: "k", label: "" }).success,
  ).toBe(false);
});

test("reorder requires at least one key", () => {
  expect(reorderInput.safeParse({ namespace: "nav", orderedKeys: [] }).success).toBe(false);
  expect(reorderInput.safeParse({ namespace: "nav", orderedKeys: ["a", "b"] }).success).toBe(true);
});

test("publish/rollback shapes", () => {
  expect(
    publishInput.safeParse({ entityType: "options_namespace", entityKey: "nav" }).success,
  ).toBe(true);
  expect(publishInput.safeParse({ entityType: "bogus", entityKey: "nav" }).success).toBe(false);
  expect(
    rollbackInput.safeParse({ entityType: "content_block", entityKey: "about", version: 2 }).success,
  ).toBe(true);
  expect(
    rollbackInput.safeParse({ entityType: "content_block", entityKey: "about", version: 0 }).success,
  ).toBe(false);
});

test("content block requires non-empty body", () => {
  expect(upsertBlockInput.safeParse({ key: "about", title: "About", body: "" }).success).toBe(false);
  expect(
    upsertBlockInput.safeParse({ key: "about", title: "About", body: "<p>Hi</p>" }).success,
  ).toBe(true);
});
