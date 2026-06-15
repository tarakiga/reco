/** Per-card action descriptors passed to TitleCard. Live in a client-safe module
 *  so both the server pages (which build them) and the client buttons (which
 *  consume them) can import the types. */
export interface CardFavourite {
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** Server-resolved: is this title already favourited by the current user? */
  initial: boolean;
  /** Server-resolved: is anyone signed in? Drives the sign-in nudge. */
  signedIn: boolean;
}

/** Per-card watchlist descriptor (quick add/remove). */
export interface CardWatchlist {
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** Server-resolved: is this title already on the user's watchlist? */
  initial: boolean;
  signedIn: boolean;
}
