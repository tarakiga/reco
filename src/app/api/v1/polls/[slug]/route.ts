import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { getPollState } from "@/services/polls";
import { jsonError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const profile = await getCurrentProfile();
  const state = await getPollState(slug, profile?.id ?? null);
  if (!state) return jsonError(404, "Vote not found");
  return NextResponse.json({ state });
}
