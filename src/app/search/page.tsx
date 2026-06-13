import { tmdb } from "@/lib/tmdb/client";
import { toSearchResults, type TitleResult, type PersonResult } from "@/lib/tmdb/transform";
import { TitleCard } from "@/components/catalog/TitleCard";
import { PersonCard } from "@/components/catalog/PersonCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <form action="/search" method="get" className="flex items-end gap-3">
        <div className="flex-1">
          <Input name="q" label="Search" defaultValue={query} />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {!query ? (
        <p className="mt-8 text-center text-text-muted">
          Search for movies, TV shows, and people.
        </p>
      ) : (
        <SearchResults query={query} />
      )}
    </div>
  );
}

async function SearchResults({ query }: { query: string }) {
  let results;
  try {
    const data = await tmdb.searchMulti(query);
    results = toSearchResults(data.results);
  } catch {
    return (
      <div className="mt-8">
        <EmptyState title="Search failed, try again" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState title={`No results for "${query}"`} />
      </div>
    );
  }

  const titles = results.filter((r): r is TitleResult => r.kind === "title");
  const people = results.filter((r): r is PersonResult => r.kind === "person");

  return (
    <div className="mt-8 space-y-10">
      {titles.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text">Titles</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {titles.map((t) => (
              <TitleCard
                key={t.tmdbId}
                href={t.href}
                title={t.title}
                year={t.year}
                posterUrl={t.posterUrl}
              />
            ))}
          </div>
        </section>
      )}
      {people.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-text">People</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {people.map((p) => (
              <PersonCard
                key={p.tmdbId}
                href={p.href}
                name={p.name}
                profileUrl={p.profileUrl}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
