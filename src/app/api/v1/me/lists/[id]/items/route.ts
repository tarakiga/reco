import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { getOrCreateTitle } from "@/services/catalog";
import { addListItem, removeListItem, reorderListItems } from "@/services/lists";
import { titleRef } from "@/lib/contracts/me";
import { reorderItemsInput, removeItemInput } from "@/lib/contracts/lists";
import { jsonError } from "@/lib/api";

async function requireProfile() {
  return getCurrentProfile();
}

/** Add a title to the list. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await requireProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const { id } = await params;
  try {
    const input = titleRef.parse(await req.json());
    const title = await getOrCreateTitle(input.mediaType, input.tmdbId);
    const ok = await addListItem(profile.id, id, title.id);
    if (!ok) return jsonError(404, "List not found");
    return NextResponse.json({ ok: true, titleId: title.id });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}

/** Remove a title from the list. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await requireProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const { id } = await params;
  try {
    const input = removeItemInput.parse(await req.json());
    const ok = await removeListItem(profile.id, id, input.titleId);
    if (!ok) return jsonError(404, "List not found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}

/** Reorder list items. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await requireProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const { id } = await params;
  try {
    const input = reorderItemsInput.parse(await req.json());
    const ok = await reorderListItems(profile.id, id, input.orderedTitleIds);
    if (!ok) return jsonError(404, "List not found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}
