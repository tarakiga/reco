import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { tmdb } from "@/lib/tmdb/client";
import { stillUrl, profileUrl } from "@/lib/tmdb/images";
import { slugify } from "@/lib/slug";
import { searchEpisodes, type EpisodeIndexEntry, type EpisodeMatch } from "@/lib/tmdb/episodes";

const GUESS_MODEL = "gemini-flash-lite-latest";

async function fetchSeason(tvId: number, n: number) {
  try {
    return await tmdb.season(tvId, n);
  } catch {
    try {
      return await tmdb.season(tvId, n); // one retry — transient TMDB hiccups / rate limits
    } catch {
      return null;
    }
  }
}

/** All episodes of a show flattened with guest stars + characters + crew, cached per show. */
async function episodeIndex(tvId: number): Promise<EpisodeIndexEntry[]> {
  "use cache";
  cacheTag(`tv-episode-index:${tvId}`);
  const detail = await tmdb.getTitle("tv", tvId);
  const nums = (detail.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .map((s) => s.season_number);
  const seasons = await Promise.all(nums.map((n) => fetchSeason(tvId, n)));

  // Never cache a partial index: if a season failed even after retry, throw so the
  // result isn't cached and the next request rebuilds — otherwise an incomplete
  // index would be served indefinitely (the "ann turkel → only 1 of 3" bug).
  if (seasons.some((s) => s === null)) {
    throw new Error("incomplete episode index");
  }

  const out: EpisodeIndexEntry[] = [];
  for (const s of seasons) {
    if (!s) continue;
    for (const e of s.episodes ?? []) {
      out.push({
        seasonNumber: s.season_number,
        episodeNumber: e.episode_number,
        name: e.name || `Episode ${e.episode_number}`,
        overview: e.overview ?? "",
        runtime: e.runtime && e.runtime > 0 ? e.runtime : null,
        airDate: e.air_date || null,
        stillUrl: stillUrl(e.still_path),
        voteAverage: e.vote_average && e.vote_average > 0 ? e.vote_average : null,
        cast: (e.guest_stars ?? []).map((g) => ({
          id: g.id,
          name: g.name,
          character: g.character || null,
          profileUrl: profileUrl(g.profile_path),
          href: `/person/${g.id}-${slugify(g.name)}`,
        })),
        guestStars: (e.guest_stars ?? []).map((g) => g.name),
        characters: (e.guest_stars ?? []).map((g) => g.character).filter((c): c is string => !!c),
        crew: (e.crew ?? []).map((c) => c.name),
      });
    }
  }
  return out;
}

export async function findEpisodes(tvId: number, query: string): Promise<EpisodeMatch[]> {
  const index = await episodeIndex(tvId);
  return searchEpisodes(index, query);
}

interface RawGuess {
  season: number;
  episode: number;
  why?: string;
}

/** Tolerant JSON-array parse: strips code fences / prose around the array. */
function parseGuesses(text: string): RawGuess[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((g) => g && Number.isFinite(Number(g.season)) && Number.isFinite(Number(g.episode)))
      .map((g) => ({
        season: Number(g.season),
        episode: Number(g.episode),
        why: typeof g.why === "string" ? g.why.trim() : undefined,
      }));
  } catch {
    return [];
  }
}

/**
 * AI fallback for episode search, used when keyword search finds nothing. Asks
 * Gemini to pick the most likely episodes from the show's real episode list,
 * using both the synopses AND its own knowledge of the show (songs, guest stars,
 * memorable scenes that aren't written in a synopsis). Every guess is verified
 * against the index, so the model can't surface an episode that doesn't exist.
 *
 * Cached per (show, query). No-op (returns []) when GEMINI_API_KEY is unset or
 * the call fails, so the finder degrades silently to its keyword behaviour.
 */
export async function guessEpisodes(tvId: number, query: string): Promise<EpisodeMatch[]> {
  "use cache";
  cacheTag(`tv-episode-guess:${tvId}`);
  cacheLife("weeks");

  const key = process.env.GEMINI_API_KEY;
  const q = query.trim();
  if (!key || q.length < 2) return [];

  let index: EpisodeIndexEntry[];
  let showName = "this show";
  try {
    index = await episodeIndex(tvId);
    const detail = await tmdb.getTitle("tv", tvId);
    showName = detail.name || showName;
  } catch {
    return [];
  }
  if (index.length === 0) return [];

  const list = index
    .map(
      (e) =>
        `S${e.seasonNumber}E${e.episodeNumber} - ${e.name}` +
        (e.overview ? ` - ${e.overview.slice(0, 160)}` : ""),
    )
    .join("\n");

  const prompt =
    `You are helping find one specific episode of the TV show "${showName}".\n` +
    `The viewer remembers it as: "${q}"\n\n` +
    `Episodes (Season x Episode - Title - synopsis):\n${list}\n\n` +
    `Return the up to 3 most likely episodes as a JSON array, each ` +
    `{"season": number, "episode": number, "why": "short reason under 15 words"}. ` +
    `Use BOTH the synopses above AND your own knowledge of the show (songs, guest ` +
    `stars, memorable moments that may not appear in a synopsis). If nothing is a ` +
    `plausible match, return []. Respond with ONLY the JSON array, no prose or code fences.`;

  let text = "";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GUESS_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
        }),
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(" ").trim() ?? "";
  } catch {
    return [];
  }

  const out: EpisodeMatch[] = [];
  const seen = new Set<string>();
  for (const g of parseGuesses(text)) {
    const k = `${g.season}-${g.episode}`;
    if (seen.has(k)) continue;
    // Verify against the real index: drop any episode the model invented.
    const entry = index.find((e) => e.seasonNumber === g.season && e.episodeNumber === g.episode);
    if (!entry) continue;
    seen.add(k);
    out.push({ ...entry, matchedOn: null, aiReason: g.why });
    if (out.length >= 3) break;
  }
  return out;
}
