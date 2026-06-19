import "server-only";
import { cacheLife } from "next/cache";
import type { GuideChannel, GuideEntry } from "./guide";

// Plex's free live channels. The channel LIST needs a token, but iptv-org has
// vendored the channel keys and the /grid EPG endpoint works without one.
const PLEX_EPG = "https://epg.provider.plex.tv";
const IPTV_PLEX = "https://raw.githubusercontent.com/iptv-org/epg/master/sites/plex.tv";

export const PLEX_REGIONS: Record<string, { name: string; tz: string }> = {
  all: { name: "Plex (Global)", tz: "America/New_York" },
  us: { name: "Plex (US)", tz: "America/New_York" },
  uk: { name: "Plex (UK)", tz: "Europe/London" },
  ca: { name: "Plex (Canada)", tz: "America/Toronto" },
  au: { name: "Plex (Australia)", tz: "Australia/Sydney" },
  de: { name: "Plex (Germany)", tz: "Europe/Berlin" },
  fr: { name: "Plex (France)", tz: "Europe/Paris" },
  es: { name: "Plex (Spain)", tz: "Europe/Madrid" },
  it: { name: "Plex (Italy)", tz: "Europe/Rome" },
  br: { name: "Plex (Brazil)", tz: "America/Sao_Paulo" },
  mx: { name: "Plex (Mexico)", tz: "America/Mexico_City" },
};

const MAX_CHANNELS = 200;
const BATCH = 24;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function fmtTime(ms: number, tz: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

async function plexChannels(region: string): Promise<{ id: string; name: string }[]> {
  "use cache";
  cacheLife("days");
  try {
    const res = await fetch(`${IPTV_PLEX}/plex.tv_${region}.channels.xml`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const out: { id: string; name: string }[] = [];
    const re = /<channel\b[^>]*\bsite_id="([^"]+)"[^>]*>([^<]*)<\/channel>/g;
    for (const m of xml.matchAll(re)) {
      const id = m[1];
      const name = decode(m[2].trim());
      if (id && name) out.push({ id, name });
    }
    return out.slice(0, MAX_CHANNELS);
  } catch {
    return [];
  }
}

interface PlexItem {
  title?: string;
  grandparentTitle?: string;
  summary?: string;
  parentIndex?: number;
  index?: number;
  Media?: { beginsAt?: number; endsAt?: number }[];
}

async function channelGrid(key: string, date: string): Promise<PlexItem[]> {
  try {
    const res = await fetch(`${PLEX_EPG}/grid?channelGridKey=${key}&date=${date}`, {
      headers: { accept: "application/json", "x-plex-provider-version": "7.2" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { MediaContainer?: { Metadata?: PlexItem[] } };
    return j.MediaContainer?.Metadata ?? [];
  } catch {
    return [];
  }
}

/** A day's Plex schedule for a region, grouped by channel. Cached per (region, date). */
export async function getPlexSchedule(region: string, date: string): Promise<GuideChannel[]> {
  "use cache";
  cacheLife("hours");

  const reg = region.toLowerCase().replace(/[^a-z]/g, "");
  const meta = PLEX_REGIONS[reg];
  if (!meta || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const list = await plexChannels(reg);
  if (list.length === 0) return [];

  const channels: GuideChannel[] = [];
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (ch) => {
        const items = await channelGrid(ch.id, date);
        if (items.length === 0) return null;
        const entries: GuideEntry[] = [];
        items.forEach((it, idx) => {
          const beginsAt = it.Media?.[0]?.beginsAt;
          const endsAt = it.Media?.[0]?.endsAt;
          if (!beginsAt) return;
          const title = it.grandparentTitle ?? it.title ?? ch.name;
          entries.push({
            id: `${ch.id}-${idx}`,
            time: fmtTime(beginsAt * 1000, meta.tz),
            airstamp: new Date(beginsAt * 1000).toISOString(),
            showName: title,
            season: it.parentIndex ?? null,
            episode: it.index ?? null,
            episodeTitle: it.title && it.title !== title ? it.title : null,
            synopsis: it.summary ?? null,
            runtime: endsAt ? Math.round((endsAt - beginsAt) / 60) : null,
            href: `/search?q=${encodeURIComponent(title)}`,
          });
        });
        return entries.length ? { channel: ch.name, entries } : null;
      }),
    );
    for (const r of results) if (r) channels.push(r);
  }

  return channels.sort((a, b) => a.channel.localeCompare(b.channel));
}
