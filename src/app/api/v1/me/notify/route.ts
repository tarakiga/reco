import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { addAlert, removeAlert, hasAlert } from "@/services/notify";
import { jsonError } from "@/lib/api";

function parseRef(body: { mediaType?: string; tmdbId?: number }) {
  const mediaType = body.mediaType;
  const tmdbId = Number(body.tmdbId);
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  return { mediaType: mediaType as "movie" | "tv", tmdbId };
}

export async function GET(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  const url = new URL(req.url);
  const ref = parseRef({ mediaType: url.searchParams.get("mediaType") ?? undefined, tmdbId: Number(url.searchParams.get("tmdbId")) });
  if (!ref) return jsonError(400, "Bad params");
  return NextResponse.json({ on: await hasAlert(profile.id, ref.mediaType, ref.tmdbId) });
}

export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const ref = parseRef((await req.json()) as { mediaType?: string; tmdbId?: number });
    if (!ref) return jsonError(400, "Bad request");
    await addAlert(profile.id, ref.mediaType, ref.tmdbId);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError(400, "Invalid request");
  }
}

export async function DELETE(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const ref = parseRef((await req.json()) as { mediaType?: string; tmdbId?: number });
    if (!ref) return jsonError(400, "Bad request");
    await removeAlert(profile.id, ref.mediaType, ref.tmdbId);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError(400, "Invalid request");
  }
}
