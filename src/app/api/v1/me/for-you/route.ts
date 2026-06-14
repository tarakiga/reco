import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { getTaste } from "@/services/taste";
import { forYou } from "@/services/for-you";
import { jsonError } from "@/lib/api";

const COLD_START_MIN = 5;

export async function GET() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");

  const taste = await getTaste(profile.id);
  if (!taste || taste.ratedCount < COLD_START_MIN) {
    return NextResponse.json({ needsMoreRatings: true, have: taste?.ratedCount ?? 0, need: COLD_START_MIN, items: [] });
  }
  const items = await forYou(profile.id, 24);
  return NextResponse.json({ needsMoreRatings: false, items });
}
