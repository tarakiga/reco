import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";
import { getOrCreateTitle } from "@/services/catalog";
import { embedTitles } from "@/services/title-embeddings";
import { defaultEmbedder } from "@/lib/taste/embedder";

export const maxDuration = 300;

const PAGE_CONCURRENCY = 8;
const TITLE_CONCURRENCY = 12;

/** Run `fn` over `items` with a bounded number of concurrent workers. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/** One-time catalog backfill: mirror + embed a range of TMDB popular pages.
 *  Idempotent (getOrCreateTitle + embedTitles both skip existing/unchanged).
 *  Mirrors with bounded concurrency so large ranges complete in reasonable time. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "tv" ? "tv" : "movie";
  const from = Math.max(1, Number(url.searchParams.get("from") ?? 1));
  const to = Math.min(500, Number(url.searchParams.get("to") ?? from));

  const pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const idLists = await mapPool(pages, PAGE_CONCURRENCY, async (page) => {
    try {
      const { results } = await tmdb.popular(type, page);
      return results.map((r) => r.id);
    } catch {
      return [] as number[];
    }
  });
  const tmdbIds = [...new Set(idLists.flat())];

  const mirrored = await mapPool(tmdbIds, TITLE_CONCURRENCY, async (tmdbId) => {
    try {
      const row = await getOrCreateTitle(type, tmdbId);
      return row.id;
    } catch {
      return null;
    }
  });
  const ids = mirrored.filter((x): x is string => x !== null);

  const embedded = await embedTitles(ids, defaultEmbedder());
  return NextResponse.json({ type, from, to, mirrored: ids.length, embedded });
}
