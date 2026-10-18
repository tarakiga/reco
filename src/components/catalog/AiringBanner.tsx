import { tvAiringInfo } from "@/services/tv-status";
import { broadcastFor, type Broadcast } from "@/services/guide";
import { cachedTodayYmd } from "@/services/clock";
import { AiringBannerLabel } from "./AiringBannerLabel";

/** The UTC day after a YYYY-MM-DD date, as YYYY-MM-DD. */
function nextDayYmd(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * One line under the hero answering "is this show still alive?". The data is
 * read on the server from the daily airing cache; the wording ("Today",
 * "Tomorrow", a weekday) is decided in the browser by AiringBannerLabel, so the
 * cached page is the same for every visitor and timezone. Every failure path
 * renders nothing rather than a broken banner.
 */
export async function AiringBanner({ tvId }: { tvId: number }) {
  const info = await tvAiringInfo(tvId);
  const ep = info.nextEpisode;

  // The GB channel line only matters on the day the episode airs. Look it up
  // only when the air date is the server's today or the day after (a visitor
  // ahead of UTC may already be on that day): the notify cron warms today's GB
  // schedule hourly, while a far-future date is warmed by nothing, and cold it
  // costs a TVmaze fetch plus a TMDB lookup per show in that day's guide.
  let broadcast: Broadcast | null = null;
  if (ep?.airDate) {
    const today = await cachedTodayYmd();
    if (ep.airDate === today || ep.airDate === nextDayYmd(today)) {
      broadcast = await broadcastFor(tvId, ep.airDate);
    }
  }

  return <AiringBannerLabel info={info} broadcast={broadcast} />;
}
