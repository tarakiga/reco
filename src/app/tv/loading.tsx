import { Skeleton } from "@/components/ui/Skeleton";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";

export default function TvLoading() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">TV Shows</h1>
      <div className="mb-6 flex flex-wrap gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      <PosterGridSkeleton />
    </div>
  );
}
