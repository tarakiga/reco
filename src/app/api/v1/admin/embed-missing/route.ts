import { NextResponse } from "next/server";
import { embedMissing } from "@/services/title-embeddings";
import { defaultEmbedder } from "@/lib/taste/embedder";

export const maxDuration = 300;

/** Maintenance: embed up to `limit` titles that have no embedding yet. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 200)), 500);
  const written = await embedMissing(limit, defaultEmbedder());
  return NextResponse.json({ written });
}
