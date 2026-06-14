import { connection, NextResponse, after } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { shuffle } from "@/services/shuffle";
import { embedTitles } from "@/services/title-embeddings";
import { defaultEmbedder } from "@/lib/taste/embedder";

export const maxDuration = 60;

function numbers(param: string | null, cap: number): number[] {
  return (param ?? "").split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, cap);
}

export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const profile = await getCurrentProfile();

  const services = numbers(url.searchParams.get("services"), 30);
  const genres = numbers(url.searchParams.get("genres"), 10);
  const typeParam = url.searchParams.get("type");
  const mediaType = typeParam === "movie" || typeParam === "tv" ? typeParam : "any";
  const matchTaste = url.searchParams.get("matchTaste") === "1" && !!profile;
  const region = (profile?.region ?? "US").toUpperCase().slice(0, 2);
  const page = Math.floor(Math.random() * 5) + 1; // variety across "Shuffle again"

  const { picks, broaden, pickIds } = await shuffle({
    region, services, mediaType, genres, matchTaste, userId: profile?.id, page,
  });

  // Opportunistic: embed the picks in the background so match % can show next time.
  after(() => embedTitles(pickIds, defaultEmbedder()).catch(() => {}));

  return NextResponse.json({ picks, broaden });
}
