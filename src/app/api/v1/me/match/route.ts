import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { matchForTitles } from "@/services/for-you";

export async function GET(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ match: {} }); // anon: no scores, not an error

  const ids = new URL(req.url).searchParams.get("titleIds")?.split(",").filter(Boolean) ?? [];
  const match = await matchForTitles(profile.id, ids.slice(0, 60));
  return NextResponse.json({ match });
}
