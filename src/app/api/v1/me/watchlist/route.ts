import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { getOrCreateTitle } from "@/services/catalog";
import { listWatchlist, setWatchStatus, removeFromWatchlist } from "@/services/user-catalog";
import { setWatchInput, titleRef } from "@/lib/contracts/me";
import { jsonError } from "@/lib/api";

async function requireProfile() {
  const p = await getCurrentProfile();
  if (!p) return null;
  return p;
}

export async function GET() {
  await connection();
  const profile = await requireProfile();
  if (!profile) return jsonError(401, "Sign in required");
  return NextResponse.json({ items: await listWatchlist(profile.id) });
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
    const input = setWatchInput.parse(body);
    const title = await getOrCreateTitle(input.mediaType, input.tmdbId);
    await setWatchStatus(profile.id, title.id, input.status);
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
    await removeFromWatchlist(profile.id, title.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    console.error(err);
    return jsonError(500, "Internal error");
  }
}
