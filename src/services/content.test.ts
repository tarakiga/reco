import { afterAll, beforeAll } from "vitest";
import { db } from "@/db";
import { auditLog, contentBlocks, configVersions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  getBlock,
  upsertBlock,
  publishBlock,
  getPublishedBlock,
  rollbackBlock,
} from "./content";

const KEY = `__vitest__block${Date.now()}`;
const ACTOR = "vitest";

async function cleanup() {
  await db.delete(contentBlocks).where(eq(contentBlocks.key, KEY));
  await db
    .delete(configVersions)
    .where(and(eq(configVersions.entityType, "content_block"), eq(configVersions.entityKey, KEY)));
  await db.delete(auditLog).where(eq(auditLog.entityKey, KEY));
}

beforeAll(cleanup);
afterAll(cleanup);

test("upsert + get working copy", async () => {
  await upsertBlock({ key: KEY, title: "About", body: "<p>v1</p>" }, ACTOR);
  const block = await getBlock(KEY);
  expect(block?.body).toBe("<p>v1</p>");
});

test("publish then draft edit: public read stays at published version", async () => {
  expect(await getPublishedBlock(KEY)).toBeNull();
  const v1 = await publishBlock(KEY, ACTOR);
  expect(v1).toBe(1);

  await upsertBlock({ key: KEY, title: "About", body: "<p>v2 draft</p>" }, ACTOR);
  expect((await getPublishedBlock(KEY))?.body).toBe("<p>v1</p>");

  await publishBlock(KEY, ACTOR);
  expect((await getPublishedBlock(KEY))?.body).toBe("<p>v2 draft</p>");
});

test("publishing a missing block is rejected", async () => {
  await expect(publishBlock("__vitest__missing", ACTOR)).rejects.toThrow(/no content block/i);
});

test("rollback restores old body into working copy", async () => {
  await rollbackBlock(KEY, 1, ACTOR);
  expect((await getBlock(KEY))?.body).toBe("<p>v1</p>");
  expect((await getPublishedBlock(KEY))?.body).toBe("<p>v2 draft</p>"); // unchanged until re-publish
});
