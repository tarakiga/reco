import { personSets, progressFor } from "@/services/completion";
import { CompletionBar } from "@/components/completion/CompletionBar";

/**
 * Per-user "how much of this person have I watched" — acting, directing and
 * writing bodies of work. Streams in a <Suspense> island because `personSets`
 * fetches the person's full crew credits from TMDB. The page passes the user's
 * watched keys in (and only renders this for signed-in visitors).
 */
export async function PersonCompletion({ personId, watched }: { personId: number; watched: Set<string> }) {
  const sets = await personSets(personId);
  const rows = (
    [
      { label: "Films & shows seen", items: sets.acted },
      { label: "Directed", items: sets.directed },
      { label: "Written", items: sets.wrote },
    ] as const
  ).filter((r) => r.items.length >= 2);
  if (rows.length === 0) return null;

  return (
    <section className="mb-8 rounded-lg border border-border bg-surface-raised p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">Your completion</h2>
      <div className="space-y-3">
        {rows.map((r) => {
          const p = progressFor(r.items, watched);
          return <CompletionBar key={r.label} label={r.label} watched={p.watched} total={p.total} />;
        })}
      </div>
    </section>
  );
}
