"use client";
import { useMatches } from "./useMatch";
import { MatchBadge } from "./MatchBadge";

export function TitleMatch({ titleId }: { titleId: string }) {
  const { data } = useMatches([titleId]);
  const match = data && titleId in data ? (data as Record<string, number>)[titleId] : undefined;
  return <MatchBadge match={match} />;
}
