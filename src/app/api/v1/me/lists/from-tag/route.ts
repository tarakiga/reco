import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { createListFromTag } from "@/services/lists";
import { fromTagInput } from "@/lib/contracts/lists";
import { jsonError } from "@/lib/api";

/** Create a draft list from one of the user's tags. */
export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const input = fromTagInput.parse(await req.json());
    const list = await createListFromTag(profile.id, input.slug);
    if (!list) return jsonError(404, "Tag not found");
    return NextResponse.json({ list });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}
