import { NextResponse } from "next/server";
import { topEpisodes } from "@/services/episode-search";

// Cold-cache builds fetch every season of a show; give long-runners room.
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tvId = Number(id);
  if (!Number.isInteger(tvId)) return NextResponse.json({ episodes: [] });
  try {
    const episodes = await topEpisodes(tvId, 10);
    return NextResponse.json({ episodes });
  } catch {
    return NextResponse.json({ error: "Failed to rank episodes" }, { status: 502 });
  }
}
