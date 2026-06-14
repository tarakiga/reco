import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { getOrCreateTitle } from "@/services/catalog";
import { embedTitles, embedMissing } from "@/services/title-embeddings";
import { defaultEmbedder } from "@/lib/taste/embedder";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const embedder = defaultEmbedder();
  const ids: string[] = [];
  for (const mediaType of ["movie", "tv"] as const) {
    try {
      const { results } = await tmdb.popular(mediaType, 1);
      for (const r of results.slice(0, 20)) {
        const row = await getOrCreateTitle(mediaType, r.id);
        ids.push(row.id);
      }
    } catch {
      /* skip on TMDB error */
    }
  }
  // Batched embedding — one request per ≤100 titles, not one per title.
  const embedded = await embedTitles(ids, embedder);
  const backfilled = await embedMissing(40, embedder);
  return NextResponse.json({ mirrored: ids.length, embedded, backfilled });
}
