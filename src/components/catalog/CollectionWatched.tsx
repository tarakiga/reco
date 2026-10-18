"use client";
import { useCardKeys } from "./useCardKeys";

/** "3/8 watched" beside a collection rail. Read in the browser from the user's
 *  card keys, so the cached page is the same for everyone; nothing when signed
 *  out or still loading. */
export function CollectionWatched({ keys }: { keys: string[] }) {
  const cardKeys = useCardKeys();
  if (cardKeys.status !== "ready") return null;
  const count = keys.filter((k) => cardKeys.has("watched", k)).length;
  return (
    <span className="text-xs text-text-muted">
      {count}/{keys.length} watched
    </span>
  );
}

/** The "Seen" corner badge on a collection card, from the same card keys. */
export function SeenBadge({ itemKey }: { itemKey: string }) {
  const cardKeys = useCardKeys();
  if (!cardKeys.has("watched", itemKey)) return null;
  return (
    <span className="absolute left-1 top-1 rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-surface">
      Seen
    </span>
  );
}
