import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { getOrCreateTitle } from "@/services/catalog";
import { embedTitle, embedMissing } from "@/services/title-embeddings";
import { defaultEmbedder } from "@/lib/taste/embedder";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const embedder = defaultEmbedder();
  let mirrored = 0;
  for (const mediaType of ["movie", "tv"] as const) {
    try {
      const { results } = await tmdb.popular(mediaType, 1);
      for (const r of results.slice(0, 20)) {
        const row = await getOrCreateTitle(mediaType, r.id);
        await embedTitle(row.id, embedder);
        mirrored++;
      }
    } catch {
      /* skip on TMDB error */
    }
  }
  const backfilled = await embedMissing(40, embedder);
  return NextResponse.json({ mirrored, backfilled });
}
