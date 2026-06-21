import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { importUserData } from "@/services/data-backup";
import { backupSchema } from "@/lib/contracts/backup";
import { jsonError } from "@/lib/api";

export const maxDuration = 60;

/** Restore (merge) an uploaded backup into the signed-in user's account. */
export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "That file isn't valid JSON");
    }
    const data = backupSchema.parse(body);
    const summary = await importUserData(profile.id, data);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "That doesn't look like a Haystackk backup", err.issues);
    console.error("import failed", err);
    return jsonError(500, "Import failed");
  }
}
