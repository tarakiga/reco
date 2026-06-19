import "server-only";
import { cacheLife } from "next/cache";
import { zonedDate } from "@/lib/guide/tz";
import type { GuideChannel, GuideEntry } from "./guide";

// Xumo's free channels. Open, keyless. Unlike Pluto/Plex it has a list EPG
// endpoint (per 6-hour block, paginated), so the whole lineup is a few dozen
// calls rather than one-per-channel. Lineup 10006 is the default (US-centric).
const XUMO = "https://valencia-app-mds.xumo.com/v2";
const LIST = "10006";
const XUMO_TZ = "America/New_York";

function fmtTime(iso: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: XUMO_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

interface XumoListItem {
  title?: string;
  guid?: { value?: string };
}

/** channelId -> channel name, from the lineup list. Cached for days. */
async function xumoChannelNames(): Promise<Map<string, string>> {
  "use cache";
  cacheLife("days");
  const map = new Map<string, string>();
  try {
    const res = await fetch(`${XUMO}/channels/list/${LIST}.json?sort=hybrid&geoId=unknown`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return map;
    const j = (await res.json()) as { channel?: { item?: XumoListItem[] } };
    for (const it of j.channel?.item ?? []) {
      const id = it.guid?.value;
      if (id && it.title) map.set(String(id), it.title);
    }
  } catch {
    /* leave empty */
  }
  return map;
}

interface XumoAsset {
  title?: string;
  episodeTitle?: string;
  descriptions?: { tiny?: string; small?: string; medium?: string };
}
interface XumoScheduleItem {
  assetId?: string;
  start?: string;
  end?: string;
}
interface XumoEpgChannel {
  channelId?: number;
  schedule?: XumoScheduleItem[];
}

/** A day's Xumo schedule, grouped by channel. Cached per date. */
export async function getXumoSchedule(date: string): Promise<GuideChannel[]> {
  "use cache";
  cacheLife("hours");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const names = await xumoChannelNames();
  const ymd = date.replace(/-/g, "");

  // Xumo's date is a UTC day, but we want the US (Eastern) local day so "on now"
  // works in the evening (when local time has crossed into the next UTC day).
  // Fetch the requested UTC day's 4 blocks plus the next UTC day's first block
  // (the local-evening spillover), then keep only the Eastern calendar day.
  const nextYmd = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  // 4 six-hour blocks, paginated 50 channels at a time. Fetch all pages up front.
  const urls: string[] = [];
  const fields = "f=asset.title&f=asset.episodeTitle&f=asset.descriptions";
  for (let block = 0; block < 4; block++) {
    for (let offset = 0; offset <= 450; offset += 50) {
      urls.push(`${XUMO}/epg/${LIST}/${ymd}/${block}.json?${fields}&limit=50&offset=${offset}`);
    }
  }
  for (let offset = 0; offset <= 450; offset += 50) {
    urls.push(`${XUMO}/epg/${LIST}/${nextYmd}/0.json?${fields}&limit=50&offset=${offset}`);
  }

  const pages = await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        return (await res.json()) as { channels?: XumoEpgChannel[]; assets?: Record<string, XumoAsset> };
      } catch {
        return null;
      }
    }),
  );

  // Accumulate schedule items per channel, with a shared asset lookup.
  const sched = new Map<string, GuideEntry[]>();
  const seen = new Map<string, Set<string>>();
  for (const page of pages) {
    if (!page?.channels) continue;
    const assets = page.assets ?? {};
    for (const ch of page.channels) {
      const cid = String(ch.channelId ?? "");
      const name = names.get(cid);
      if (!name) continue;
      const list = sched.get(cid) ?? [];
      const dedup = seen.get(cid) ?? new Set<string>();
      for (const s of ch.schedule ?? []) {
        if (!s.start || !s.assetId) continue;
        if (zonedDate(s.start, XUMO_TZ) !== date) continue; // keep the Eastern day only
        const key = `${s.start}-${s.assetId}`;
        if (dedup.has(key)) continue;
        dedup.add(key);
        const asset = s.assetId ? assets[s.assetId] : undefined;
        const title = asset?.title ?? name;
        const epTitle = asset?.episodeTitle && asset.episodeTitle !== title ? asset.episodeTitle : null;
        const st = Date.parse(s.start);
        const sp = s.end ? Date.parse(s.end) : NaN;
        list.push({
          id: `${cid}-${s.start}`,
          time: fmtTime(s.start),
          airstamp: s.start,
          showName: title,
          season: null,
          episode: null,
          episodeTitle: epTitle,
          synopsis: asset?.descriptions?.small ?? asset?.descriptions?.medium ?? asset?.descriptions?.tiny ?? null,
          runtime: !Number.isNaN(st) && !Number.isNaN(sp) ? Math.round((sp - st) / 60_000) : null,
          href: `/search?q=${encodeURIComponent(title)}`,
        });
      }
      sched.set(cid, list);
      seen.set(cid, dedup);
    }
  }

  const channels: GuideChannel[] = [];
  for (const [cid, entries] of sched) {
    if (entries.length === 0) continue;
    entries.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    channels.push({ channel: names.get(cid) ?? cid, entries });
  }
  return channels.sort((a, b) => a.channel.localeCompare(b.channel));
}
