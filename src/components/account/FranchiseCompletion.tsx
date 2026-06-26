import { TitleCard } from "@/components/catalog/TitleCard";
import { CompletionBar } from "@/components/completion/CompletionBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { favouriteProp, watchlistProp, type CardActionContext } from "@/services/favourites";
import type { FranchiseProgress } from "@/services/completion";

/** Account "Completion" tab — franchises you've started, closest-to-done first. */
export function FranchiseCompletion({
  data,
  ctx,
}: {
  data: { inProgress: FranchiseProgress[]; completed: string[] };
  ctx: CardActionContext;
}) {
  if (data.inProgress.length === 0 && data.completed.length === 0) {
    return (
      <EmptyState
        title="No franchises in progress"
        description="Mark some movies watched (rate them, log them, or set them to “Watched”) and we'll track the franchises you can finish."
      />
    );
  }

  return (
    <div className="space-y-6">
      {data.inProgress.map((f) => (
        <section key={f.collectionId} className="rounded-lg border border-border bg-surface-raised p-4">
          <CompletionBar label={f.name} watched={f.watched} total={f.total} />
          <p className="mb-3 mt-2 text-xs text-text-muted">
            {f.remaining.length} to go. Finish what you started.
          </p>

          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">To watch</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {f.remaining.map((t) => (
              <TitleCard
                key={t.tmdbId}
                href={t.href}
                title={t.title}
                year={t.year}
                posterUrl={t.posterUrl}
                favourite={favouriteProp(ctx, t.mediaType, t.tmdbId)}
                watchlist={watchlistProp(ctx, t.mediaType, t.tmdbId)}
              />
            ))}
          </div>

          {f.seen.length > 0 && (
            <>
              <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-wide text-text-muted">
                Seen ({f.seen.length})
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {f.seen.map((t) => (
                  <div key={t.tmdbId} className="relative">
                    <span className="absolute right-1 top-1 z-10 rounded-full bg-success px-1.5 py-0.5 text-[10px] font-bold text-black">
                      ✓
                    </span>
                    <div className="opacity-70">
                      <TitleCard
                        href={t.href}
                        title={t.title}
                        year={t.year}
                        posterUrl={t.posterUrl}
                        favourite={favouriteProp(ctx, t.mediaType, t.tmdbId)}
                        watchlist={watchlistProp(ctx, t.mediaType, t.tmdbId)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      ))}

      {data.completed.length > 0 && (
        <section className="rounded-lg border border-border bg-surface-raised p-4">
          <h3 className="mb-2 text-sm font-semibold text-text">Completed 🏆</h3>
          <div className="flex flex-wrap gap-2">
            {data.completed.map((name) => (
              <span
                key={name}
                className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs text-text"
              >
                {name} ✓
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
