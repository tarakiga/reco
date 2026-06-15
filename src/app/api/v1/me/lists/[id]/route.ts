import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { updateList, deleteList } from "@/services/lists";
import { updateListInput } from "@/lib/contracts/lists";
import { jsonError } from "@/lib/api";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const { id } = await params;
  try {
    const input = updateListInput.parse(await req.json());
    const ok = await updateList(profile.id, id, input);
    if (!ok) return jsonError(404, "List not found");
    return NextResponse.json({ ok: true });
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
  const ok = await deleteList(profile.id, id);
  if (!ok) return jsonError(404, "List not found");
  return NextResponse.json({ ok: true });
}
