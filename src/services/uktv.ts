import "server-only";
import { cacheLife } from "next/cache";
import type { GuideChannel, GuideEntry } from "./guide";

// U (UKTV)'s free EPG API. Open, keyless, one call per channel/day, and the
// richest of our sources: full season/episode numbers + synopsis. Covers UKTV's
// own 8 channels only (not ITV3/Sky/etc).
const UKTV_EPG = "https://cfschedules.uktv.co.uk/api/epg";
const TZ = "Europe/London";

const UKTV_CHANNELS: { slug: string; name: string }[] = [
  { slug: "dave", name: "U&Dave" },
  { slug: "gold", name: "U&Gold" },
  { slug: "alibi", name: "U&Alibi" },
  { slug: "drama", name: "U&Drama" },
  { slug: "yesterday", name: "U&Yesterday" },
  { slug: "eden", name: "U&Eden" },
  { slug: "home", name: "U&Home" },
  { slug: "w", name: "W" },
];

function fmtTime(iso: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

interface UktvProgramme {
  brand_title?: string;
  episode_title?: string;
  episode_number?: number;
  series_number?: string;
  synopsis?: string;
  start_time?: string;
  end_time?: string;
  program_id?: number;
}

async function channelEpg(slug: string, apiDate: string): Promise<UktvProgramme[]> {
  try {
    const res = await fetch(`${UKTV_EPG}?channel=${slug}&start=${apiDate}&days=1`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { listing?: { programmes?: UktvProgramme[] }[] };
    return (j.listing ?? []).flatMap((d) => d.programmes ?? []);
  } catch {
    return [];
  }
}

/** A day's U (UKTV) schedule, grouped by channel. Cached per date. */
export async function getUktvSchedule(date: string): Promise<GuideChannel[]> {
  "use cache";
  cacheLife("hours");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  // U's API wants Y-M-D without zero padding (e.g. 2026-6-20).
  const apiDate = date.split("-").map(Number).join("-");

  const results = await Promise.all(
    UKTV_CHANNELS.map(async (ch) => {
      const programmes = await channelEpg(ch.slug, apiDate);
      if (programmes.length === 0) return null;
      const entries: GuideEntry[] = programmes.map((p) => {
        const st = p.start_time ? Date.parse(p.start_time) : NaN;
        const sp = p.end_time ? Date.parse(p.end_time) : NaN;
        const showName = p.brand_title ?? ch.name;
        const season = p.series_number && /^\d+$/.test(p.series_number) ? Number(p.series_number) : null;
        return {
          id: p.program_id ?? `${ch.slug}-${p.start_time}`,
          time: p.start_time ? fmtTime(p.start_time) : null,
          airstamp: p.start_time ?? null,
          showName,
          season,
          episode: typeof p.episode_number === "number" ? p.episode_number : null,
          episodeTitle: p.episode_title && p.episode_title !== showName ? p.episode_title : null,
          synopsis: p.synopsis ?? null,
          runtime: !Number.isNaN(st) && !Number.isNaN(sp) ? Math.round((sp - st) / 60_000) : null,
          href: `/search?q=${encodeURIComponent(showName)}`,
        };
      });
      entries.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
      return { channel: ch.name, entries } satisfies GuideChannel;
    }),
  );

  return results
    .filter((c): c is GuideChannel => c !== null)
    .sort((a, b) => a.channel.localeCompare(b.channel));
}
