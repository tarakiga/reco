import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { exportUserData } from "@/services/data-backup";
import { jsonError } from "@/lib/api";

export const maxDuration = 60;

/** Full JSON backup of the signed-in user's data. */
export async function GET() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const data = await exportUserData(profile.id);
    return NextResponse.json(data, {
      headers: { "Content-Disposition": `attachment; filename="haystackk-backup.json"` },
    });
  } catch (err) {
    console.error("export failed", err);
    return jsonError(500, "Could not build your backup");
  }
}
