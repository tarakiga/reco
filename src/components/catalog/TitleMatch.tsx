"use client";
import { useMatches } from "./useMatch";
import { useTitleState } from "./useTitleState";
import { MatchBadge } from "./MatchBadge";

/**
 * Match % for the title page. The cached page may carry an empty `titleId`
 * (the title was not in the catalog when the page was cached), so this falls
 * back to the row id the signed-in user's own title-state read returns. That
 * query is shared with TitleActions, so it costs no extra request. Renders
 * nothing until a title id is known.
 */
export function TitleMatch({
  titleId,
  mediaType,
  tmdbId,
}: {
  titleId: string;
  mediaType: "movie" | "tv";
  tmdbId: number;
}) {
  const state = useTitleState(mediaType, tmdbId);
  const id = titleId || state.data?.titleId || "";
  const { data } = useMatches(id ? [id] : []);
  if (!id) return null;
  const match = data && id in data ? (data as Record<string, number>)[id] : undefined;
  return <MatchBadge match={match} />;
}
