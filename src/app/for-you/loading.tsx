import { PosterGridSkeleton } from "@/components/catalog/Skeletons";

export default function ForYouLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 h-8 w-40 animate-pulse rounded-md bg-surface-overlay" />
      <PosterGridSkeleton />
    </div>
  );
}
