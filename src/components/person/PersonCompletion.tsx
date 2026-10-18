"use client";
import { useMemo } from "react";
import { progressFor, releasedItems, type CompletionItem } from "@/lib/completion";
import { useBrowserToday } from "@/components/ui/BrowserDate";
import { useCardKeys } from "@/components/catalog/useCardKeys";
import { CompletionBar } from "@/components/completion/CompletionBar";

export interface PersonCompletionSets {
  acted: CompletionItem[];
  directed: CompletionItem[];
  wrote: CompletionItem[];
}

/**
 * Per-user "how much of this person have I watched": acting, directing and
 * writing bodies of work. The page passes the cached credit sets in; which of
 * them count as released depends on the visitor's local date, and the watched
 * keys come from the browser, so nothing renders until both are known and the
 * visitor is signed in.
 */
export function PersonCompletion({ sets }: { sets: PersonCompletionSets }) {
  const today = useBrowserToday();
  const cardKeys = useCardKeys();
  const ready = cardKeys.status === "ready" && today !== null;

  const rows = useMemo(() => {
    if (today === null) return [];
    return (
      [
        { label: "Films & shows seen", items: releasedItems(sets.acted, today) },
        { label: "Directed", items: releasedItems(sets.directed, today) },
        { label: "Written", items: releasedItems(sets.wrote, today) },
      ] as const
    ).filter((r) => r.items.length >= 2);
  }, [sets, today]);

  if (!ready || rows.length === 0) return null;

  return (
    <section className="mb-8 rounded-lg border border-border bg-surface-raised p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">Your completion</h2>
      <div className="space-y-3">
        {rows.map((r) => {
          const keys = new Set(r.items.filter((i) => cardKeys.has("watched", i.key)).map((i) => i.key));
          const p = progressFor(r.items, keys);
          return <CompletionBar key={r.label} label={r.label} watched={p.watched} total={p.total} />;
        })}
      </div>
    </section>
  );
}
