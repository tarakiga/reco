"use client";
import type { Broadcast } from "@/services/guide";
import { airingLabel, type TvAiringInfo } from "@/lib/tv-status";
import { yearFromDate } from "@/lib/slug";
import { useBrowserToday } from "@/components/ui/BrowserDate";

/**
 * The airing line's text, decided in the browser so "Today", "Tomorrow" and the
 * weekday are right in the visitor's own timezone and the cached page is the
 * same for everyone. Renders nothing until mounted. The channel line only shows
 * when the episode airs on the visitor's today.
 */
export function AiringBannerLabel({ info, broadcast }: { info: TvAiringInfo; broadcast: Broadcast | null }) {
  const today = useBrowserToday();
  if (today == null) return null;
  const label = airingLabel(info, today);
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

  const showBroadcast = broadcast != null && label.kind === "next-episode" && ep?.airDate === today;

  return (
    <p className={`mt-2 text-sm font-medium ${tone}`}>
      {text}
      {showBroadcast && (
        <span className="text-text-muted">
          {" "}· {broadcast.time ? `${broadcast.time} on ` : "on "}
          {broadcast.channel}
        </span>
      )}
    </p>
  );
}
