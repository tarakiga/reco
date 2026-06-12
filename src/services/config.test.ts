import { afterAll, beforeAll } from "vitest";
import { db } from "@/db";
import { auditLog, configOptions, configVersions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  listOptions,
  upsertOption,
  deleteOption,
  reorderOptions,
} from "./config";

const NS = `__vitest__${Date.now()}`;
const ACTOR = "vitest";

async function cleanup() {
  await db.delete(configOptions).where(eq(configOptions.namespace, NS));
  await db
    .delete(configVersions)
    .where(and(eq(configVersions.entityType, "options_namespace"), eq(configVersions.entityKey, NS)));
  await db.delete(auditLog).where(eq(auditLog.entityKey, NS));
}

beforeAll(cleanup);
afterAll(cleanup);

test("upsert creates then updates an option", async () => {
  await upsertOption({ namespace: NS, key: "home", label: "Home", value: { href: "/" } }, ACTOR);
  let rows = await listOptions(NS);
  expect(rows).toHaveLength(1);
  expect(rows[0].label).toBe("Home");

  await upsertOption({ namespace: NS, key: "home", label: "Start", value: { href: "/" } }, ACTOR);
  rows = await listOptions(NS);
  expect(rows).toHaveLength(1);
  expect(rows[0].label).toBe("Start");
});

test("reorder rewrites sortOrder by position and rejects non-permutations", async () => {
  await upsertOption({ namespace: NS, key: "a", label: "A" }, ACTOR);
  await upsertOption({ namespace: NS, key: "b", label: "B" }, ACTOR);
  await reorderOptions({ namespace: NS, orderedKeys: ["b", "home", "a"] }, ACTOR);
  const rows = await listOptions(NS);
  expect(rows.map((r) => r.key)).toEqual(["b", "home", "a"]);

  await expect(
    reorderOptions({ namespace: NS, orderedKeys: ["b"] }, ACTOR),
  ).rejects.toThrow(/permutation/i);
});

test("delete removes the option", async () => {
  await deleteOption(NS, "a", ACTOR);
  const rows = await listOptions(NS);
  expect(rows.map((r) => r.key)).toEqual(["b", "home"]);
});

test("mutations are audited", async () => {
  const entries = await db.select().from(auditLog).where(eq(auditLog.entityKey, NS));
  expect(entries.length).toBeGreaterThanOrEqual(5);
  expect(entries.every((e) => e.actor === ACTOR)).toBe(true);
});
