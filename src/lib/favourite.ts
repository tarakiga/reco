/** Per-card action descriptors passed to TitleCard. Live in a client-safe module
 *  so both the server pages (which build them) and the client buttons (which
 *  consume them) can import the types. The current user's marks are not part
 *  of these: the buttons read them in the browser through useCardKeys. */
export interface CardTarget {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

/** TitleCard `favourite` prop: shows a heart to favourite without opening the title. */
export type CardFavourite = CardTarget;

/** TitleCard `watchlist` prop: shows a bookmark for a quick watchlist add or remove. */
export type CardWatchlist = CardTarget;

export function cardTarget(mediaType: "movie" | "tv", tmdbId: number): CardTarget {
  return { mediaType, tmdbId };
}
