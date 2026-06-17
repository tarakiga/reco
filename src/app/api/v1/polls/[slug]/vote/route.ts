import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { castVote, PollError } from "@/services/polls";
import { resolveOrIssueVoter, voterCookie } from "@/services/voter";
import { castVoteInput } from "@/lib/contracts/polls";
import { jsonError } from "@/lib/api";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  try {
    const { mediaType, tmdbId } = castVoteInput.parse(await req.json());
    // Guests vote too — minted a cookie token when they have none yet.
    const { identity, issueToken } = await resolveOrIssueVoter();
    const state = await castVote(slug, identity, mediaType, tmdbId);
    if (!state) return jsonError(404, "Vote not found");
    const res = NextResponse.json({ state });
    if (issueToken) res.cookies.set(voterCookie(issueToken));
    return res;
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    if (err instanceof PollError) return jsonError(err.status, err.message);
    return jsonError(400, "Invalid request");
  }
}
