import { tvAiringInfo } from "@/services/tv-status";
import { broadcastFor } from "@/services/guide";
import { airingLabel } from "@/lib/tv-status";
import { yearFromDate } from "@/lib/slug";

/**
 * One line under the hero answering "is this show still alive?". Server
 * rendered for everyone from the daily airing cache; every failure path
 * renders nothing rather than a broken banner. The GB channel line is an
 * enhancement that only appears when the guide lists the air date.
 */
export async function AiringBanner({ tvId, todayYmd }: { tvId: number; todayYmd: string }) {
  const info = await tvAiringInfo(tvId);
  const label = airingLabel(info, todayYmd);
  if (!label) return null;

  const ep = info.nextEpisode;
  let text: string;
  let tone = "text-text";
  switch (label.kind) {
    case "next-episode": {
      const epName = ep?.name ? ` '${ep.name}'` : "";
      text = `New episode ${label.when} · S${ep?.seasonNumber} E${ep?.episodeNumber}${epName}`;
      tone = "text-accent-text";
      break;
    }
    case "returning":
      text = "Returning series · next episode not yet scheduled";
      break;
    case "in-production":
      text = "In production";
      break;
    case "ended": {
      const year = yearFromDate(info.lastAirDate);
      text = year ? `Ended · final episode aired ${year}` : "Ended";
      break;
    }
    case "cancelled":
      text = "Cancelled";
      tone = "text-danger";
      break;
  }

  // The channel line only fires when the episode airs today: the notify cron
  // already warms today's GB schedule hourly, so this is always a cache read.
  // A future date's schedule is warmed by nothing, and cold it costs a TVmaze
  // fetch plus a TMDB lookup per show in that day's guide, on anonymous traffic.
  const broadcast =
    label.kind === "next-episode" && ep?.airDate === todayYmd ? await broadcastFor(tvId, ep.airDate) : null;

  return (
    <p className={`mt-2 text-sm font-medium ${tone}`}>
      {text}
      {broadcast && (
        <span className="text-text-muted">
          {" "}· {broadcast.time ? `${broadcast.time} on ` : "on "}
          {broadcast.channel}
        </span>
      )}
    </p>
  );
}
