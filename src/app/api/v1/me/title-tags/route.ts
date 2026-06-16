import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { getOrCreateTitle } from "@/services/catalog";
import { getTitleTags, addTitleTag, removeTitleTag } from "@/services/tags";
import { addTitleTagInput, removeTitleTagInput } from "@/lib/contracts/tags";
import { jsonError } from "@/lib/api";

/** Tags the current user has on a title (?mediaType=&tmdbId=). */
export async function GET(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const sp = new URL(req.url).searchParams;
  const mediaType = sp.get("mediaType");
  const tmdbId = Number(sp.get("tmdbId"));
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId)) {
    return jsonError(400, "Bad params");
  }
  const title = await getOrCreateTitle(mediaType, tmdbId);
  return NextResponse.json({ tags: await getTitleTags(profile.id, title.id) });
}

export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const input = addTitleTagInput.parse(await req.json());
    const tag = await addTitleTag(profile.id, input.mediaType, input.tmdbId, input.name);
    if (!tag) return jsonError(400, "Invalid tag");
    return NextResponse.json({ tag });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}

export async function DELETE(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const input = removeTitleTagInput.parse(await req.json());
    const ok = await removeTitleTag(profile.id, input.mediaType, input.tmdbId, input.tagId);
    if (!ok) return jsonError(404, "Tag not found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}
