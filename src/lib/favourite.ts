/** Per-card favourite descriptor passed to TitleCard. Lives in a client-safe
 *  module so both the server pages (which build it) and the client heart button
 *  (which consumes it) can import the type. */
export interface CardFavourite {
  mediaType: "movie" | "tv";
  tmdbId: number;
  /** Server-resolved: is this title already favourited by the current user? */
  initial: boolean;
  /** Server-resolved: is anyone signed in? Drives the sign-in nudge. */
  signedIn: boolean;
}
