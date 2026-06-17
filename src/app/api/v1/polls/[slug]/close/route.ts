import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { closePoll, PollError } from "@/services/polls";
import { jsonError } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const state = await closePoll(slug, profile.id);
    if (!state) return jsonError(404, "Vote not found");
    return NextResponse.json({ state });
  } catch (err) {
    if (err instanceof PollError) return jsonError(err.status, err.message);
    return jsonError(400, "Invalid request");
  }
}
