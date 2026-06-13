export function MatchBadge({ match }: { match: number | undefined }) {
  if (match == null) return null;
  const tone = match >= 75 ? "text-success" : match >= 50 ? "text-warning" : "text-text-muted";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-surface-raised/90 px-2 py-0.5 text-xs font-medium ${tone}`}>
      {match}% match
    </span>
  );
}
