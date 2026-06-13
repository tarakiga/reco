import { Skeleton } from "@/components/ui/Skeleton";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";

export default function WatchlistLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="space-y-10">
        <section>
          <Skeleton className="mb-4 h-6 w-32" />
          <PosterGridSkeleton count={6} />
        </section>
      </div>
    </div>
  );
}
