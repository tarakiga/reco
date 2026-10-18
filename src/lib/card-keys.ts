// Client-safe: no server-only imports. Shared by the card-keys endpoint and
// the client components that overlay per-user marks on cached catalog cards.

export type CardKeyKind = "favourites" | "watchlist" | "watched";

export interface CardKeys {
  signedIn: boolean;
  favourites: string[];
  watchlist: string[];
  watched: string[];
}

export const EMPTY_CARD_KEYS: CardKeys = {
  signedIn: false,
  favourites: [],
  watchlist: [],
  watched: [],
};

export function cardKey(mediaType: "movie" | "tv", tmdbId: number): string {
  return `${mediaType}:${tmdbId}`;
}

export function withCardKey(
  keys: CardKeys,
  kind: CardKeyKind,
  key: string,
  on: boolean,
): CardKeys {
  const rest = keys[kind].filter((k) => k !== key);
  return { ...keys, [kind]: on ? [...rest, key] : rest };
}
