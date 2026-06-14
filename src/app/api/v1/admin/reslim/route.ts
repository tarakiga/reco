import { NextResponse } from "next/server";
import { gt, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { titles } from "@/db/schema";
import { slimTitleMetadata } from "@/lib/tmdb/slim";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";

export const maxDuration = 300;

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/** One-time maintenance: re-slim stored title metadata in id-order batches.
 *  Cursor via ?after=<uuid>; returns the last id processed for the next call. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit") ?? 250)), 500);
  const after = url.searchParams.get("after") || ZERO_UUID;

  const rows = await db
    .select({ id: titles.id, metadata: titles.metadata })
    .from(titles)
    .where(gt(titles.id, after))
    .orderBy(asc(titles.id))
    .limit(limit);

  for (const r of rows) {
    const slim = slimTitleMetadata((r.metadata ?? {}) as TmdbTitleDetail);
    await db.update(titles).set({ metadata: slim }).where(eq(titles.id, r.id));
  }

  return NextResponse.json({ processed: rows.length, lastId: rows.at(-1)?.id ?? null });
}
