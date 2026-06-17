import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { castVote, PollError } from "@/services/polls";
import { castVoteInput } from "@/lib/contracts/polls";
import { jsonError } from "@/lib/api";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required to vote");
  try {
    const { mediaType, tmdbId } = castVoteInput.parse(await req.json());
    const state = await castVote(slug, profile.id, mediaType, tmdbId);
    if (!state) return jsonError(404, "Vote not found");
    return NextResponse.json({ state });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    if (err instanceof PollError) return jsonError(err.status, err.message);
    return jsonError(400, "Invalid request");
  }
}
