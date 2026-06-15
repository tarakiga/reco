import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { createList, listUserLists } from "@/services/lists";
import { createListInput } from "@/lib/contracts/lists";
import { jsonError } from "@/lib/api";

export async function GET() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  return NextResponse.json({ lists: await listUserLists(profile.id) });
}

export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const input = createListInput.parse(await req.json());
    const list = await createList(profile.id, input);
    return NextResponse.json({ list });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}
