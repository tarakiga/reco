import { notFound } from "next/navigation";
import { titlesByLocation, isWikidataQid } from "@/services/wikidata-listing";
import { TitleCard } from "@/components/catalog/TitleCard";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { heading } = await titlesByLocation(id);
  return { title: heading ? `Filmed or set in ${heading}` : "Locations" };
}

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isWikidataQid(id)) notFound();
  const { heading, items } = await titlesByLocation(id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm font-medium uppercase tracking-wide text-text-muted">Filmed or set in</p>
      <h1 className="mb-6 text-2xl font-bold text-text sm:text-3xl">{heading || "this place"}</h1>
      {items.length === 0 ? (
        <EmptyState title="Nothing to show" description="We couldn't find titles for this location." />
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {items.map((it) => (
            <TitleCard key={`${it.mediaType}-${it.tmdbId}`} href={it.href} title={it.title} year={it.year} posterUrl={it.posterUrl} />
          ))}
        </div>
      )}
    </div>
  );
}
