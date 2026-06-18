import { NextResponse } from "next/server";
import { findEpisodes, guessEpisodes } from "@/services/episode-search";

// Cold-cache builds fetch every season of a show; give long-runners room.
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tvId = Number(id);
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!Number.isInteger(tvId) || q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  try {
    const results = await findEpisodes(tvId, q);
    // Keyword search found nothing — fall back to an AI best guess over the real
    // episode list. Isolated in its own try so a model/key failure never breaks
    // the keyword path.
    let guesses: Awaited<ReturnType<typeof guessEpisodes>> = [];
    if (results.length === 0) {
      try {
        guesses = await guessEpisodes(tvId, q);
      } catch {
        guesses = [];
      }
    }
    return NextResponse.json({ results, guesses });
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
