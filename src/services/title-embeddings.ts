import "server-only";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings } from "@/db/schema";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { buildTasteDescriptor, descriptorHash } from "@/lib/taste/descriptor";
import type { Embedder } from "@/lib/taste/embedder";

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

/** Embed up to `limit` local titles that have no embedding yet (cron/backfill). */
export async function embedMissing(limit: number, embedder: Embedder): Promise<number> {
  const rows = await db
    .select({ id: titles.id })
    .from(titles)
    .leftJoin(titleEmbeddings, eq(titleEmbeddings.titleId, titles.id))
    .where(isNull(titleEmbeddings.titleId))
    .limit(limit);
  for (const r of rows) await embedTitle(r.id, embedder);
  return rows.length;
}
