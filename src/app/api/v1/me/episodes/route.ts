import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { getWatchedEpisodes, setEpisodeWatched, setSeasonWatched } from "@/services/episode-watches";
import { jsonError } from "@/lib/api";

/** Episodes the user has marked watched for a show. */
export async function GET(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const tmdbId = Number(new URL(req.url).searchParams.get("tmdbId"));
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return jsonError(400, "Bad tmdbId");
  return NextResponse.json({ episodes: await getWatchedEpisodes(profile.id, tmdbId) });
}

/** Toggle one episode ({season, episode}) or a whole season ({season, episodes[]}). */
export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const body = (await req.json()) as {
      tmdbId?: number;
      season?: number;
      episode?: number;
      episodes?: number[];
      watched?: boolean;
    };
    const tmdbId = Number(body.tmdbId);
    const season = Number(body.season);
    const watched = body.watched !== false;
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !Number.isInteger(season)) {
      return jsonError(400, "Bad request");
    }
    if (Array.isArray(body.episodes)) {
      const eps = body.episodes.map(Number).filter((n) => Number.isInteger(n) && n > 0);
      await setSeasonWatched(profile.id, tmdbId, season, eps, watched);
    } else {
      const episode = Number(body.episode);
      if (!Number.isInteger(episode)) return jsonError(400, "Bad episode");
      await setEpisodeWatched(profile.id, tmdbId, season, episode, watched);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError(400, "Invalid request");
  }
}
