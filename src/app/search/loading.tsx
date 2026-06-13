import { Skeleton } from "@/components/ui/Skeleton";
import { PosterGridSkeleton } from "@/components/catalog/Skeletons";

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="mt-8">
        <PosterGridSkeleton />
      </div>
    </div>
  );
}
