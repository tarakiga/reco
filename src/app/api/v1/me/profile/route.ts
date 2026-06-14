import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { updateProfile } from "@/services/user-catalog";
import { updateProfileInput } from "@/lib/contracts/me";
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
  return NextResponse.json({
    username: profile.username,
    region: profile.region,
    role: profile.role,
    preferredGenres: profile.preferredGenres ?? [],
  });
}

export async function PATCH(req: Request) {
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
    const input = updateProfileInput.parse(body);
    await updateProfile(profile.id, input);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    console.error(err);
    return jsonError(500, "Internal error");
  }
}
