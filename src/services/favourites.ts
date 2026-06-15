import "server-only";
import { getCurrentProfile } from "./profile";
import { listFavouriteKeys } from "./user-catalog";
import type { CardFavourite } from "@/lib/favourite";

export interface FavouriteContext {
  signedIn: boolean;
  keys: Set<string>;
}

/**
 * The current user's favourite membership, for server-marking grid cards in one
 * query. Resolves Clerk auth, so it makes the calling page dynamic — only use it
 * in already-dynamic routes (those awaiting searchParams/params), never on
 * statically-prerendered pages.
 */
export async function favouriteContext(): Promise<FavouriteContext> {
  const profile = await getCurrentProfile();
  if (!profile) return { signedIn: false, keys: new Set() };
  return { signedIn: true, keys: new Set(await listFavouriteKeys(profile.id)) };
}

/** Build the TitleCard `favourite` prop for one result. */
export function favouriteProp(
  ctx: FavouriteContext,
  mediaType: "movie" | "tv",
  tmdbId: number,
): CardFavourite {
  return {
    mediaType,
    tmdbId,
    initial: ctx.keys.has(`${mediaType}:${tmdbId}`),
    signedIn: ctx.signedIn,
  };
}
