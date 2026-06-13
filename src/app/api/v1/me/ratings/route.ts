import { connection, NextResponse, after } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { getOrCreateTitle } from "@/services/catalog";
import { setRating, removeRating } from "@/services/user-catalog";
import { setRatingInput, titleRef } from "@/lib/contracts/me";
import { jsonError } from "@/lib/api";
import { onSignalChanged } from "@/services/taste-hooks";

async function requireProfile() {
  const p = await getCurrentProfile();
  if (!p) return null;
  return p;
}

export async function PUT(req: Request) {
  await connection();
  const profile = await requireProfile();
  if (!profile) return jsonError(401, "Sign in required");

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }
    const input = setRatingInput.parse(body);
    const title = await getOrCreateTitle(input.mediaType, input.tmdbId);
    await setRating(profile.id, title.id, input.score);
    after(() => onSignalChanged(profile.id, input.mediaType, input.tmdbId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    console.error(err);
    return jsonError(500, "Internal error");
  }
}

export async function DELETE(req: Request) {
  await connection();
  const profile = await requireProfile();
  if (!profile) return jsonError(401, "Sign in required");

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }
    const input = titleRef.parse(body);
    const title = await getOrCreateTitle(input.mediaType, input.tmdbId);
    await removeRating(profile.id, title.id);
    after(() => onSignalChanged(profile.id, input.mediaType, input.tmdbId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    console.error(err);
    return jsonError(500, "Internal error");
  }
}
