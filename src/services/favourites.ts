import "server-only";
import { getCurrentProfile } from "./profile";
import { listFavouriteKeys, listWatchlistKeys } from "./user-catalog";
import type { CardFavourite, CardWatchlist } from "@/lib/favourite";

export interface CardActionContext {
  signedIn: boolean;
  favourites: Set<string>;
  watchlist: Set<string>;
}

/**
 * The current user's favourite + watchlist membership, for server-marking grid
 * cards in one pass (two cheap queries). Resolves Clerk auth, so it makes the
 * calling page dynamic — only use it in already-dynamic routes.
 */
export async function cardActionContext(): Promise<CardActionContext> {
  const profile = await getCurrentProfile();
  if (!profile) return { signedIn: false, favourites: new Set(), watchlist: new Set() };
  const [favourites, watchlist] = await Promise.all([
    listFavouriteKeys(profile.id),
    listWatchlistKeys(profile.id),
  ]);
  return { signedIn: true, favourites: new Set(favourites), watchlist: new Set(watchlist) };
}

/** Build the TitleCard `favourite` prop for one result. */
export function favouriteProp(
  ctx: CardActionContext,
  mediaType: "movie" | "tv",
  tmdbId: number,
): CardFavourite {
  return {
    mediaType,
    tmdbId,
    initial: ctx.favourites.has(`${mediaType}:${tmdbId}`),
    signedIn: ctx.signedIn,
  };
}

/** Build the TitleCard `watchlist` prop for one result. */
export function watchlistProp(
  ctx: CardActionContext,
  mediaType: "movie" | "tv",
  tmdbId: number,
): CardWatchlist {
  return {
    mediaType,
    tmdbId,
    initial: ctx.watchlist.has(`${mediaType}:${tmdbId}`),
    signedIn: ctx.signedIn,
  };
}
