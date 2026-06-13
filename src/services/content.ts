import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { configVersions, contentBlocks, type ContentBlockRow } from "@/db/schema";
import { writeAudit } from "./audit";
import { publishedBlock, type PublishedBlock, type UpsertBlockInput } from "@/lib/contracts/config";
import { listVersions } from "./config";

export async function getBlock(key: string): Promise<ContentBlockRow | null> {
  const [row] = await db.select().from(contentBlocks).where(eq(contentBlocks.key, key));
  return row ?? null;
}

export async function listBlocks(): Promise<ContentBlockRow[]> {
  return db.select().from(contentBlocks).orderBy(contentBlocks.key);
}

export async function upsertBlock(input: UpsertBlockInput, actor: string) {
  await db
    .insert(contentBlocks)
    .values({ ...input, updatedBy: actor, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: contentBlocks.key,
      set: { title: input.title, body: input.body, updatedBy: actor, updatedAt: new Date() },
    });
  await writeAudit({ actor, action: "block.upsert", entityType: "content_block", entityKey: input.key });
}

export async function publishBlock(key: string, actor: string): Promise<number> {
  const block = await getBlock(key);
  if (!block) throw new Error(`No content block "${key}" to publish`);
  const snapshot: PublishedBlock = { key: block.key, title: block.title, body: block.body };
  const versions = await listVersions("content_block", key);
  const version = (versions[0]?.version ?? 0) + 1;
  await db.insert(configVersions).values({
    entityType: "content_block",
    entityKey: key,
    version,
    snapshot,
    publishedBy: actor,
  });
  await writeAudit({
    actor,
    action: "block.publish",
    entityType: "content_block",
    entityKey: key,
    detail: { version },
  });
  return version;
}

export async function getPublishedBlock(key: string): Promise<PublishedBlock | null> {
  const [row] = await db
    .select()
    .from(configVersions)
    .where(and(eq(configVersions.entityType, "content_block"), eq(configVersions.entityKey, key)))
    .orderBy(desc(configVersions.version))
    .limit(1);
  if (!row) return null;
  return publishedBlock.parse(row.snapshot);
}

export async function rollbackBlock(key: string, version: number, actor: string) {
  const [row] = await db
    .select()
    .from(configVersions)
    .where(
      and(
        eq(configVersions.entityType, "content_block"),
        eq(configVersions.entityKey, key),
        eq(configVersions.version, version),
      ),
    );
  if (!row) throw new Error(`No version ${version} for content block "${key}"`);
  const snap = publishedBlock.parse(row.snapshot);
  await upsertBlock({ key: snap.key, title: snap.title, body: snap.body }, actor);
  await writeAudit({
    actor,
    action: "block.rollback",
    entityType: "content_block",
    entityKey: key,
    detail: { restoredVersion: version },
  });
}
