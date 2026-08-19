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
  if (text.length <= SYNOPSIS_MAX) return text;
  const cut = text.slice(0, SYNOPSIS_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace > SYNOPSIS_MAX * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}...`;
}
