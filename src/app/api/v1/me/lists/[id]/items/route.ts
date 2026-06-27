import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { getOrCreateTitle } from "@/services/catalog";
import { TmdbError } from "@/lib/tmdb/client";
import { addListItem, removeListItem, reorderListItems, setListItemNote, setListItemTier } from "@/services/lists";
import { addListItemInput, reorderItemsInput, removeItemInput, patchListItemInput } from "@/lib/contracts/lists";
import { jsonError } from "@/lib/api";

async function requireProfile() {
  return getCurrentProfile();
}

/** Add a title, or one of its episodes, to the list. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await requireProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const { id } = await params;
  try {
    const input = addListItemInput.parse(await req.json());
    const title = await getOrCreateTitle(input.mediaType, input.tmdbId);
    const item = await addListItem(profile.id, id, {
      titleId: title.id,
      season: input.season ?? null,
      episode: input.episode ?? null,
      episodeName: input.episodeName ?? null,
    });
    if (!item) return jsonError(404, "List not found");
    return NextResponse.json({ ok: true, itemId: item.id, titleId: title.id });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    if (err instanceof TmdbError) {
      return err.status >= 500 || err.status === 429
        ? jsonError(503, "The movie database is busy right now. Please try again in a moment.")
        : jsonError(404, "That title couldn't be found.");
    }
    return jsonError(400, "Invalid request");
  }
}

/** Remove an item from the list. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await requireProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const { id } = await params;
  try {
    const input = removeItemInput.parse(await req.json());
    const ok = await removeListItem(profile.id, id, input.itemId);
    if (!ok) return jsonError(404, "List not found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}

/** Update one item: its curator's note and/or its tier bucket. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const profile = await requireProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const { id } = await params;
  try {
    const input = patchListItemInput.parse(await req.json());
    let ok = true;
    if (input.note !== undefined) ok = await setListItemNote(profile.id, id, input.itemId, input.note);
    if (ok && input.tier !== undefined) ok = await setListItemTier(profile.id, id, input.itemId, input.tier);
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
    const ok = await reorderListItems(profile.id, id, input.orderedItemIds);
    if (!ok) return jsonError(404, "List not found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}
