import "server-only";
import { eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings } from "@/db/schema";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { buildTasteDescriptor, descriptorHash } from "@/lib/taste/descriptor";
import type { Embedder } from "@/lib/taste/embedder";

/** Max inputs per embedder request (Voyage allows up to 128). */
const EMBED_BATCH = 100;

/** Embed a single title's taste descriptor; no-op if the descriptor is unchanged. */
export async function embedTitle(titleId: string, embedder: Embedder): Promise<void> {
  const [title] = await db.select().from(titles).where(eq(titles.id, titleId));
  if (!title) return;
  const meta = (title.metadata ?? {}) as TmdbTitleDetail;
  const descriptor = buildTasteDescriptor(meta, title.mediaType);
  const hash = descriptorHash(descriptor);

  const [existing] = await db
    .select({ hash: titleEmbeddings.descriptorHash })
    .from(titleEmbeddings)
    .where(eq(titleEmbeddings.titleId, titleId));
  if (existing && existing.hash === hash) return; // unchanged

  const [embedding] = await embedder.embed([descriptor], "document");
  await db
    .insert(titleEmbeddings)
    .values({ titleId, embedding, model: embedder.model, descriptorHash: hash, builtAt: new Date() })
    .onConflictDoUpdate({
      target: titleEmbeddings.titleId,
      set: { embedding, model: embedder.model, descriptorHash: hash, builtAt: new Date() },
    });
}

/**
 * Embed many titles using BATCHED embedder calls (one request per ≤100 titles)
 * instead of one request per title. This is essential with rate-limited
 * providers (e.g. Voyage): embedding N titles one-at-a-time hits the per-minute
 * request limit and silently drops most of them. Skips titles whose descriptor
 * is unchanged. Returns the number of embeddings written.
 */
export async function embedTitles(titleIds: string[], embedder: Embedder): Promise<number> {
  const ids = [...new Set(titleIds)];
  if (ids.length === 0) return 0;

  const rows = await db.select().from(titles).where(inArray(titles.id, ids));
  const existing = await db
    .select({ titleId: titleEmbeddings.titleId, hash: titleEmbeddings.descriptorHash })
    .from(titleEmbeddings)
    .where(inArray(titleEmbeddings.titleId, ids));
  const existingHash = new Map(existing.map((e) => [e.titleId, e.hash]));

  const pending: { titleId: string; descriptor: string; hash: string }[] = [];
  for (const t of rows) {
    const meta = (t.metadata ?? {}) as TmdbTitleDetail;
    const descriptor = buildTasteDescriptor(meta, t.mediaType);
    const hash = descriptorHash(descriptor);
    if (existingHash.get(t.id) === hash) continue; // unchanged → skip
    pending.push({ titleId: t.id, descriptor, hash });
  }
  if (pending.length === 0) return 0;

  let written = 0;
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const chunk = pending.slice(i, i + EMBED_BATCH);
    const vectors = await embedder.embed(chunk.map((c) => c.descriptor), "document");
    const now = new Date();
    for (let j = 0; j < chunk.length; j++) {
      await db
        .insert(titleEmbeddings)
        .values({ titleId: chunk[j].titleId, embedding: vectors[j], model: embedder.model, descriptorHash: chunk[j].hash, builtAt: now })
        .onConflictDoUpdate({
          target: titleEmbeddings.titleId,
          set: { embedding: vectors[j], model: embedder.model, descriptorHash: chunk[j].hash, builtAt: now },
        });
      written++;
    }
  }
  return written;
}

/** Embed up to `limit` local titles that have no embedding yet (cron/backfill), batched. */
export async function embedMissing(limit: number, embedder: Embedder): Promise<number> {
  const rows = await db
    .select({ id: titles.id })
    .from(titles)
    .leftJoin(titleEmbeddings, eq(titleEmbeddings.titleId, titles.id))
    .where(isNull(titleEmbeddings.titleId))
    .limit(limit);
  return embedTitles(rows.map((r) => r.id), embedder);
}
