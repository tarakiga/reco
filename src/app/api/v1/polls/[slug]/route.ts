import { connection, NextResponse } from "next/server";
import { getPollState } from "@/services/polls";
import { resolveOrIssueVoter, voterCookie } from "@/services/voter";
import { jsonError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  // Issue the guest cookie on first load so a vote later is recognised as theirs.
  const { identity, issueToken } = await resolveOrIssueVoter();
  const state = await getPollState(slug, identity);
  if (!state) return jsonError(404, "Vote not found");
  const res = NextResponse.json({ state });
  if (issueToken) res.cookies.set(voterCookie(issueToken));
  return res;
}
