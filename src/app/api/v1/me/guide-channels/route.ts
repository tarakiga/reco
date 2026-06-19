import { connection, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { getGuideChannels, setGuideChannels } from "@/services/guide-channels";
import { jsonError } from "@/lib/api";

const putSchema = z.object({
  country: z.string().min(1).max(40),
  channels: z.array(z.string().min(1).max(160)).max(500),
});

export async function GET() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  return NextResponse.json({ channels: await getGuideChannels(profile.id) });
}

export async function PUT(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }
    const input = putSchema.parse(body);
    await setGuideChannels(profile.id, input.country, input.channels);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    console.error(err);
    return jsonError(500, "Internal error");
  }
}
