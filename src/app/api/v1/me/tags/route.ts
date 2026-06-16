import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { listUserTags } from "@/services/tags";
import { jsonError } from "@/lib/api";

/** All of the current user's tags (for autocomplete + the account tab). */
export async function GET() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  return NextResponse.json({ tags: await listUserTags(profile.id) });
}
