import "server-only";
import { cacheLife } from "next/cache";
import { zonedDate } from "@/lib/guide/tz";
import type { GuideChannel, GuideEntry } from "./guide";

// Pluto TV's free ad-supported (FAST) channels. Pluto's channel-LIST endpoint is
// geo-gated, but the per-channel EPG endpoint (api.pluto.tv/v2/channels/{id}) is
// open. We take the channel-id lists iptv-org maintains, then query Pluto per
// channel. Free, keyless, nothing stored beyond the cache.
const PLUTO_API = "https://api.pluto.tv/v2/channels";
const IPTV_EPG = "https://raw.githubusercontent.com/iptv-org/epg/master/sites/pluto.tv";

// Region code -> display name + a representative timezone for clock times.
export const PLUTO_REGIONS: Record<string, { name: string; tz: string }> = {
  us: { name: "Pluto TV (US)", tz: "America/New_York" },
  uk: { name: "Pluto TV (UK)", tz: "Europe/London" },
  ca: { name: "Pluto TV (Canada)", tz: "America/Toronto" },
  au: { name: "Pluto TV (Australia)", tz: "Australia/Sydney" },
  de: { name: "Pluto TV (Germany)", tz: "Europe/Berlin" },
  fr: { name: "Pluto TV (France)", tz: "Europe/Paris" },
  es: { name: "Pluto TV (Spain)", tz: "Europe/Madrid" },
  it: { name: "Pluto TV (Italy)", tz: "Europe/Rome" },
  br: { name: "Pluto TV (Brazil)", tz: "America/Sao_Paulo" },
};

const MAX_CHANNELS = 500; // safety bound on the per-channel fan-out (US has ~400)
const BATCH = 50;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function strip(html?: string | null): string | null {
  if (!html) return null;
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t || null;
}

function fmtTime(iso: string, tz: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16) || null;
  }
}

/** Channel id + name list for a Pluto region (from iptv-org). Cached for days. */
async function plutoChannels(region: string): Promise<{ id: string; name: string }[]> {
  "use cache";
  cacheLife("days");
  try {
    const res = await fetch(`${IPTV_EPG}/pluto.tv_${region}.channels.xml`, {
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

interface PlutoTimeline {
  title?: string;
  start?: string;
  stop?: string;
  episode?: { season?: number; number?: number; name?: string; description?: string };
}

async function channelEpg(
  id: string,
  startISO: string,
  stopISO: string,
): Promise<{ name?: string; timelines?: PlutoTimeline[] } | null> {
  try {
    const res = await fetch(`${PLUTO_API}/${id}?start=${startISO}&stop=${stopISO}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as { name?: string; timelines?: PlutoTimeline[] };
  } catch {
    return null;
  }
}

/**
 * A day's Pluto schedule for a region, grouped by channel. Cached per
 * (region, date). Returns [] for unknown regions or upstream failure.
 */
export async function getPlutoSchedule(region: string, date: string): Promise<GuideChannel[]> {
  "use cache";
  cacheLife("hours");

  const reg = region.toLowerCase().replace(/[^a-z]/g, "");
  const meta = PLUTO_REGIONS[reg];
  if (!meta || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const list = await plutoChannels(reg);
  if (list.length === 0) return [];

  // Fetch a window spanning the day boundary (yesterday..tomorrow UTC) so we can
  // keep the region's full local calendar day; a bare UTC-day window misses the
  // currently-airing programme at the edges, breaking "on now".
  const baseMs = Date.parse(`${date}T00:00:00Z`);
  const start = new Date(baseMs - 86_400_000).toISOString();
  const stop = new Date(baseMs + 2 * 86_400_000).toISOString();

  const channels: GuideChannel[] = [];
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (ch) => {
        const epg = await channelEpg(ch.id, start, stop);
        const channelName = epg?.name ?? ch.name;
        const timelines = (epg?.timelines ?? []).filter((t) => {
          if (t.start == null || zonedDate(t.start, meta.tz) !== date) return false;
          // Drop Pluto's placeholder blocks: titled like the channel with episode
          // number 0 (a long "no info" filler that otherwise overlaps the real
          // programmes). Real content has number >= 1, so single-show pop-up
          // channels (Family Ties) and curated channels (90s Throwback -> Election)
          // keep their actual shows/movies.
          const ep = t.episode;
          const brandTitle = (t.title ?? "").trim() === channelName.trim();
          const placeholder = ep == null || ep.number == null || ep.number === 0;
          return !(brandTitle && placeholder);
        });
        if (timelines.length === 0) return null;
        const entries: GuideEntry[] = timelines.map((t, idx) => {
          const st = t.start ? Date.parse(t.start) : NaN;
          const sp = t.stop ? Date.parse(t.stop) : NaN;
          const runtime =
            !Number.isNaN(st) && !Number.isNaN(sp) ? Math.round((sp - st) / 60_000) : null;
          const title = t.title ?? ch.name;
          return {
            id: `${ch.id}-${idx}`,
            time: t.start ? fmtTime(t.start, meta.tz) : null,
            airstamp: t.start ?? null,
            showName: title,
            season: t.episode?.season ?? null,
            episode: t.episode?.number ?? null,
            episodeTitle: t.episode?.name && t.episode.name !== title ? t.episode.name : null,
            synopsis: strip(t.episode?.description),
            runtime,
            href: `/search?q=${encodeURIComponent(title)}`,
          };
        });
        return { channel: channelName, entries };
      }),
    );
    for (const r of results) if (r) channels.push(r);
  }

  return channels.sort((a, b) => a.channel.localeCompare(b.channel));
}
