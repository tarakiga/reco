import { getCurrentProfile } from "@/services/profile";
import { personSets, watchedTitleKeys, progressFor } from "@/services/completion";
import { CompletionBar } from "@/components/completion/CompletionBar";

/**
 * Per-user "how much of this person have I watched" — acting, directing and
 * writing bodies of work. Dynamic island (resolves the signed-in user), so the
 * person page renders it inside a <Suspense>. Hidden for signed-out visitors.
 */
export async function PersonCompletion({ personId }: { personId: number }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [sets, watched] = await Promise.all([personSets(personId), watchedTitleKeys(profile.id)]);
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
