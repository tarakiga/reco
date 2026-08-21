import { tvAiringInfo } from "@/services/tv-status";
import { broadcastFor } from "@/services/guide";
import { airingLabel } from "@/lib/tv-status";
import { yearFromDate } from "@/lib/slug";
import { shiftYmd } from "@/lib/release";

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

  // Only worth a guide lookup when the episode airs inside the next week: the
  // guide realistically lists near dates, and a far-future date would pay a
  // cold TVmaze fetch for a day that is almost certainly empty. YMD strings
  // compare lexicographically, so this is a plain string comparison.
  const broadcast =
    label.kind === "next-episode" && ep?.airDate && ep.airDate < shiftYmd(todayYmd, 7)
      ? await broadcastFor(tvId, ep.airDate)
      : null;

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
