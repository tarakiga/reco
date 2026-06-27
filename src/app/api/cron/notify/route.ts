import { NextResponse } from "next/server";
import { listAllAlerts, clearAlert } from "@/services/notify";
import { sendPushToUser, pushEnabled } from "@/services/push";
import { getSchedule } from "@/services/guide";

// Checks the broadcast guide for any alerted title airing in the next few hours
// and pushes a heads-up, then clears the alert (one-shot). Triggered by Vercel
// Cron. NOTE: currently the GB broadcast guide only — extend per region later.
export const maxDuration = 60;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const HREF_RE = /\/title\/(?:movie|tv)\/(\d+)-/;

export async function GET(req: Request) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!pushEnabled()) return NextResponse.json({ ok: true, sent: 0, note: "push not configured" });

  const alerts = await listAllAlerts();
  if (alerts.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const byTmdb = new Map<number, typeof alerts>();
  for (const a of alerts) {
    const arr = byTmdb.get(a.tmdbId) ?? [];
    arr.push(a);
    byTmdb.set(a.tmdbId, arr);
  }

  const guide = await getSchedule("GB", ymd(new Date())).catch(() => []);
  const now = Date.now();
  const WINDOW_MS = 3 * 60 * 60 * 1000; // airing within the next 3 hours

  let sent = 0;
  const fired = new Set<string>();
  for (const channel of guide) {
    for (const e of channel.entries) {
      const m = e.href.match(HREF_RE);
      if (!m) continue;
      const matches = byTmdb.get(Number(m[1]));
      if (!matches || !e.airstamp) continue;
      const start = Date.parse(e.airstamp);
      if (Number.isNaN(start) || start < now - 5 * 60 * 1000 || start > now + WINDOW_MS) continue;
      for (const a of matches) {
        const key = `${a.userId}:${a.titleId}`;
        if (fired.has(key)) continue;
        fired.add(key);
        await sendPushToUser(a.userId, {
          title: `${a.title} is on soon`,
          body: `${channel.channel}${e.time ? ` at ${e.time}` : ""}`,
          url: e.href,
        });
        await clearAlert(a.userId, a.titleId).catch(() => {});
        sent++;
      }
    }
  }
  return NextResponse.json({ ok: true, sent });
}
