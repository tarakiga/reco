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
 * Title/person detail placeholder: mirrors the real layout — a hero with
 * poster + heading block (optional backdrop banner), then a main column and a
 * facts sidebar.
 */
export function DetailSkeleton({ backdrop = false }: { backdrop?: boolean }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Hero */}
      <div className="relative -mx-4 -mt-8 mb-8 overflow-hidden px-4 pt-8 sm:rounded-b-2xl">
        {backdrop && (
          <Skeleton className="absolute inset-0 -z-10 rounded-none" />
        )}
        <div className="flex flex-col gap-6 pt-20 sm:flex-row sm:items-end sm:pt-32">
          <div className="w-28 shrink-0 sm:w-40">
            <Skeleton className="aspect-2/3 w-full rounded-lg" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-52" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </div>
      </div>

      {/* Body: main column + facts sidebar */}
      <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0">
          <Skeleton className="mb-8 h-16 w-full rounded-lg" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-2 h-4 w-11/12" />
          <Skeleton className="mb-8 h-4 w-4/6" />
          <Skeleton className="mb-4 h-6 w-32" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-2/3 w-28 shrink-0 rounded-md" />
            ))}
          </div>
        </div>
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>
    </div>
  );
}
