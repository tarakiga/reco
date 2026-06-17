import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { addDiaryEntry, removeDiaryEntry, titleDiaryDates } from "@/services/diary";
import { addDiaryInput, removeDiaryInput } from "@/lib/contracts/diary";
import { jsonError } from "@/lib/api";

/** Dates the user has logged for a title (?mediaType=&tmdbId=). */
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
  return NextResponse.json({ dates: await titleDiaryDates(profile.id, mediaType, tmdbId) });
}

export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const input = addDiaryInput.parse(await req.json());
    const entry = await addDiaryEntry(profile.id, input.mediaType, input.tmdbId, input.date);
    if (!entry) return jsonError(400, "Couldn't log it");
    return NextResponse.json({ entry });
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
    const input = removeDiaryInput.parse(await req.json());
    const ok = await removeDiaryEntry(profile.id, input.entryId);
    if (!ok) return jsonError(404, "Entry not found");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    return jsonError(400, "Invalid request");
  }
}
