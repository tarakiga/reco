import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { getWrapped } from "@/services/wrapped";
import { jsonError } from "@/lib/api";

/** Compact "Year in Film" teaser for the December home-page banner. */
export async function GET() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const year = new Date().getFullYear();
  const w = await getWrapped(profile.id, year);
  return NextResponse.json({
    year,
    logs: w.logs,
    minutes: w.minutes,
    topGenre: w.topGenres[0]?.name ?? null,
  });
}
