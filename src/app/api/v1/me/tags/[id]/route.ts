import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { renameTag, deleteTag } from "@/services/tags";
import { renameTagInput } from "@/lib/contracts/tags";
import { jsonError } from "@/lib/api";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const { id } = await params;
  try {
    const input = renameTagInput.parse(await req.json());
    const slug = await renameTag(profile.id, id, input.name);
    if (!slug) return jsonError(400, "Couldn't rename (name may already be in use)");
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const { id } = await params;
  const ok = await deleteTag(profile.id, id);
  if (!ok) return jsonError(404, "Tag not found");
  return NextResponse.json({ ok: true });
}
