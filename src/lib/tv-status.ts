// Client-safe mapping of a TMDB TV `status` to a card badge. Only terminal
// states get a badge — ongoing/returning shows stay unbadged so the grid stays clean.

export interface StatusBadge {
  label: string;
  tone: "neutral" | "danger";
}

export function statusBadge(status: string | null | undefined): StatusBadge | null {
  if (!status) return null;
  const s = status.trim().toLowerCase();
  if (s === "ended") return { label: "Ended", tone: "neutral" };
  if (s === "canceled" || s === "cancelled") return { label: "Cancelled", tone: "danger" };
  return null;
}
