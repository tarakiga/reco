import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { z } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { createPoll, deletePoll, listUserPolls, PollError } from "@/services/polls";
import { createPollInput } from "@/lib/contracts/polls";
import { jsonError } from "@/lib/api";

export async function GET() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  return NextResponse.json({ polls: await listUserPolls(profile.id) });
}

export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const input = createPollInput.parse(await req.json());
    const poll = await createPoll(profile.id, input);
    return NextResponse.json({ poll });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    if (err instanceof PollError) return jsonError(err.status, err.message);
    return jsonError(400, "Invalid request");
  }
}

export async function DELETE(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(await req.json());
    const ok = await deletePoll(profile.id, id);
    return ok ? NextResponse.json({ ok }) : jsonError(404, "Vote not found");
  } catch {
    return jsonError(400, "Invalid request");
  }
}
