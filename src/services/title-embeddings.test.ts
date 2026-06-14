import { eq } from "drizzle-orm";
import { db } from "@/db";
import { titles, titleEmbeddings } from "@/db/schema";
import { embedTitle } from "./title-embeddings";
import { FakeEmbedder } from "@/lib/taste/embedder";

const TMDB_ID = 999000001;

async function seedTitle() {
  const [row] = await db
    .insert(titles)
    .values({
      tmdbId: TMDB_ID,
      mediaType: "movie",
      slug: "__vitest__embed",
      title: "Vitest Movie",
      metadata: { id: TMDB_ID, title: "Vitest Movie", genres: [{ id: 1, name: "Drama" }] },
      refreshedAt: new Date(),
    })
    .onConflictDoUpdate({ target: [titles.tmdbId, titles.mediaType], set: { slug: "__vitest__embed" } })
    .returning();
  return row;
}

afterAll(async () => {
  await db.delete(titles).where(eq(titles.tmdbId, TMDB_ID));
});

test("embedTitle stores an embedding and is idempotent on unchanged descriptor", async () => {
  const title = await seedTitle();
  const embedder = new FakeEmbedder();

  await embedTitle(title.id, embedder);
  const [first] = await db.select().from(titleEmbeddings).where(eq(titleEmbeddings.titleId, title.id));
  expect(first.embedding).toHaveLength(1024);
  expect(first.model).toBe("fake");

  // Re-run: same descriptor → built_at unchanged (skipped).
  await embedTitle(title.id, embedder);
  const [second] = await db.select().from(titleEmbeddings).where(eq(titleEmbeddings.titleId, title.id));
  expect(second.builtAt.getTime()).toBe(first.builtAt.getTime());
});
