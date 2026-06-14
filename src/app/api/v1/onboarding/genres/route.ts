import { NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb/client";

async function combinedGenres() {
  "use cache";
  const [movie, tv] = await Promise.all([tmdb.genres("movie"), tmdb.genres("tv")]);
  const byId = new Map<number, string>();
  for (const g of [...movie.genres, ...tv.genres]) byId.set(g.id, g.name);
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET() {
  try {
    return NextResponse.json({ genres: await combinedGenres() });
  } catch {
    return NextResponse.json({ genres: [] });
  }
}
