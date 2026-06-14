import { notFound } from "next/navigation";
import { titlesBySource, isWikidataQid } from "@/services/wikidata-listing";
import { TitleCard } from "@/components/catalog/TitleCard";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { heading } = await titlesBySource(id);
  return { title: heading ? `Based on ${heading}` : "Adaptations" };
}

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isWikidataQid(id)) notFound();
  const { heading, items } = await titlesBySource(id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm font-medium uppercase tracking-wide text-text-muted">Based on</p>
      <h1 className="mb-6 text-2xl font-bold text-text sm:text-3xl">{heading || "this source"}</h1>
      {items.length === 0 ? (
        <EmptyState title="Nothing to show" description="We couldn't find other titles based on this." />
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
