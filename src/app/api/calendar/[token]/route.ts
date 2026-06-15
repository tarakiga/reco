import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getEpg } from "@/services/epg";
import { buildEpgIcs } from "@/lib/ics";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Private, subscribable iCalendar feed of a user's upcoming episodes. The token
 * is the profile's UUID (unguessable, not exposed elsewhere) — calendar apps
 * can't send auth cookies, so the secret lives in the URL, like Google's own
 * private iCal addresses. Add it once and the calendar app polls + alerts.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const id = token.replace(/\.ics$/i, "");
  if (!UUID.test(id)) return new NextResponse("Not found", { status: 404 });

  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id));
  if (!profile) return new NextResponse("Not found", { status: 404 });

  const entries = await getEpg(profile.id);
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const ics = buildEpgIcs(entries, { name: "Haystackk — Coming up", now });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="haystackk.ics"',
      // Let the CDN/calendar clients cache for an hour; they re-poll anyway.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
