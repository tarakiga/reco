import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentProfile } from "./profile";

const COOKIE = "hsk_voter";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/**
 * Who's voting. Signed-in users vote as their account (stable across devices);
 * guests vote by an anonymous cookie token. `voterKey` is the identity used for
 * one-vote-per-person + round-2 eligibility: "u:<profileId>" or "a:<token>".
 */
export interface VoterIdentity {
  userId: string | null;
  voterKey: string;
}

/** Read-only resolve (server components). Null when a guest has no token yet. */
export async function resolveVoter(): Promise<VoterIdentity | null> {
  const profile = await getCurrentProfile();
  if (profile) return { userId: profile.id, voterKey: `u:${profile.id}` };
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? { userId: null, voterKey: `a:${token}` } : null;
}

/**
 * Resolve the voter, minting a fresh guest token when needed. Returns the token
 * to set on the response (`issueToken`) so the caller (a route handler) can
 * persist the cookie — server components can't set cookies.
 */
export async function resolveOrIssueVoter(): Promise<{
  identity: VoterIdentity;
  issueToken: string | null;
}> {
  const profile = await getCurrentProfile();
  if (profile) return { identity: { userId: profile.id, voterKey: `u:${profile.id}` }, issueToken: null };

  const existing = (await cookies()).get(COOKIE)?.value;
  if (existing) return { identity: { userId: null, voterKey: `a:${existing}` }, issueToken: null };

  const token = randomBytes(16).toString("hex");
  return { identity: { userId: null, voterKey: `a:${token}` }, issueToken: token };
}

/** Cookie options for persisting a freshly-issued guest voter token. */
export function voterCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  };
}
