import { yearFromDate } from "@/lib/slug";

// Deliberately only the fields the card text actually derives from. The show
// title and episode name are rendered directly by the callers, so they are not
// arguments here.
export interface EpisodeCardInput {
  showYear: number | null;
  season: number;
  episode: number;
  airDate: string | null;
  overview: string;
}

export interface EpisodeCardFields {
  metaLine: string;
  year: number | null;
  synopsis: string | null;
}

const SYNOPSIS_MAX = 240;

/**
 * The text of an episode share card. Pure, so the wording, the year rule and
 * the clamping are testable without rendering an image.
 */
export function episodeCardFields(input: EpisodeCardInput): EpisodeCardFields {
  return {
    metaLine: `S${input.season} - E${input.episode}`,
    // The card is about the episode, so its air year wins. The show year is the
    // fallback when TMDB has no air date for it.
    year: yearFromDate(input.airDate) ?? input.showYear,
    synopsis: clamp(input.overview.trim()),
  };
}

function clamp(text: string): string | null {
  if (!text) return null;
  // Cut on code points, not code units, so the boundary can never land inside a
  // surrogate pair and emit half an emoji into the share card.
  const chars = [...text];
  if (chars.length <= SYNOPSIS_MAX) return text;
  const cut = chars.slice(0, SYNOPSIS_MAX).join("");
  const lastSpace = cut.lastIndexOf(" ");
  // Below this threshold the last space is so far back that cutting there would
  // throw away most of the synopsis, so accept a mid-word cut instead.
  const body = lastSpace > SYNOPSIS_MAX * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}...`;
}
