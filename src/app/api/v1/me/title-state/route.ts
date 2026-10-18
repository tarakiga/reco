import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { getOrCreateTitle } from "@/services/catalog";
import { getTitleState } from "@/services/user-catalog";
import { mediaType as mediaTypeSchema } from "@/lib/contracts/me";
import { z } from "zod";

export async function GET(req: Request) {
  await connection();

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ status: null, score: null, favourite: false, signedIn: false });
  }

  const { searchParams } = new URL(req.url);
  const parsedMediaType = mediaTypeSchema.safeParse(searchParams.get("mediaType"));
  const parsedTmdbId = z.coerce.number().int().positive().safeParse(searchParams.get("tmdbId"));

  if (!parsedMediaType.success || !parsedTmdbId.success) {
    return NextResponse.json({ error: "Invalid mediaType or tmdbId" }, { status: 400 });
  }

  const title = await getOrCreateTitle(parsedMediaType.data, parsedTmdbId.data);
  const state = await getTitleState(profile.id, title.id);

  // titleId: the persisted catalog row, so the page can show the match badge
  // even when its cached render predates this title entering the catalog.
  return NextResponse.json({ ...state, signedIn: true, titleId: title.id });
}
