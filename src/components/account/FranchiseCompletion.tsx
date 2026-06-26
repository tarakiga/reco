import Link from "next/link";
import { TitleCard } from "@/components/catalog/TitleCard";
import { CompletionBar } from "@/components/completion/CompletionBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { favouriteProp, watchlistProp, type CardActionContext } from "@/services/favourites";
import type { FranchiseProgress, CompletedFranchise } from "@/services/completion";

/** Account "Completion" tab — franchises you've started, closest-to-done first. */
export function FranchiseCompletion({
  data,
  ctx,
}: {
  data: { inProgress: FranchiseProgress[]; completed: CompletedFranchise[] };
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
          <h3 className="mb-3 text-sm font-semibold text-text">Completed 🏆</h3>
          <div className="space-y-5">
            {data.completed.map((f) => (
              <div key={f.collectionId}>
                <p className="mb-2 text-sm font-medium text-text">
                  {f.name} <span className="text-success">✓</span>{" "}
                  <span className="text-xs font-normal text-text-muted">all {f.items.length} watched</span>
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {f.items.map((t) => (
                    <Link key={t.tmdbId} href={t.href} className="group block" title={t.title}>
                      <div className="aspect-2/3 overflow-hidden rounded border border-border bg-surface-overlay">
                        {t.posterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-opacity group-hover:opacity-80" />
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-[11px] text-text-muted group-hover:text-text">{t.title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
