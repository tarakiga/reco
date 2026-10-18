import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { listFavouriteKeys, listWatchlistKeys } from "@/services/user-catalog";
import { watchedTitleKeys } from "@/services/completion";
import { EMPTY_CARD_KEYS, type CardKeys } from "@/lib/card-keys";

const HEADERS = { "Cache-Control": "private, no-store" };

export async function GET() {
  // Per-user data: must never be prerendered or cached.
  await connection();

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(EMPTY_CARD_KEYS, { headers: HEADERS });
  }

  const [favourites, watchlist, watched] = await Promise.all([
    listFavouriteKeys(profile.id),
    listWatchlistKeys(profile.id),
    watchedTitleKeys(profile.id),
  ]);

  const body: CardKeys = {
    signedIn: true,
    favourites,
    watchlist,
    watched: [...watched],
  };
  return NextResponse.json(body, { headers: HEADERS });
}
