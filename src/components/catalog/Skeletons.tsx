import { Skeleton } from "@/components/ui/Skeleton";

/** Single poster-card placeholder: matches TitleCard/PersonCard (aspect-2/3 + two text lines). */
export function PosterCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-2/3 w-full rounded-md" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />
      <Skeleton className="mt-1 h-3 w-1/2" />
    </div>
  );
}

/** Responsive poster grid placeholder — matches the catalog grid used on search/browse/filmography. */
export function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <PosterCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Title/person detail placeholder: optional backdrop banner, poster + heading block,
 * a couple of overview lines, and a section grid — mirrors the real detail layout.
 */
export function DetailSkeleton({ backdrop = false }: { backdrop?: boolean }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {backdrop && (
        <Skeleton className="mb-8 h-56 w-full rounded-xl sm:h-72 lg:h-80" />
      )}
      <div className="mb-8 flex gap-6">
        <div className="w-32 shrink-0 sm:w-40">
          <Skeleton className="aspect-2/3 w-full rounded-lg" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-end gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
        </div>
      </div>

      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-11/12" />
      <Skeleton className="mb-8 h-4 w-4/6" />

      <Skeleton className="mb-4 h-6 w-32" />
      <PosterGridSkeleton count={6} />
    </div>
  );
}
