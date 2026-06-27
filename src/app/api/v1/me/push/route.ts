import { connection, NextResponse } from "next/server";
import { getCurrentProfile } from "@/services/profile";
import { saveSubscription, removeSubscription } from "@/services/push";
import { jsonError } from "@/lib/api";

/** Store a web-push subscription for this device. */
export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    const body = (await req.json()) as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
    const s = body.subscription;
    if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) return jsonError(400, "Bad subscription");
    await saveSubscription(profile.id, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
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
    const { endpoint } = (await req.json()) as { endpoint?: string };
    if (endpoint) await removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError(400, "Invalid request");
  }
}
