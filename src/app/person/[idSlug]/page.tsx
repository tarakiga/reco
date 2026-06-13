import { notFound } from "next/navigation";
import { getOrCreatePerson } from "@/services/catalog";
import { TmdbError } from "@/lib/tmdb/client";
import { parseIdSlug } from "@/lib/tmdb/detail";
import { profileUrl } from "@/lib/tmdb/images";
import { filmography, personFacts } from "@/lib/tmdb/person";
import type { TmdbPersonDetail } from "@/lib/tmdb/types";
import { TitleCard } from "@/components/catalog/TitleCard";
import { HeroBackdrop } from "@/components/catalog/HeroBackdrop";
import { AmbientBackground } from "@/components/catalog/AmbientBackground";
import { FactsPanel } from "@/components/catalog/FactsPanel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ idSlug: string }>;
}) {
  const { idSlug } = await params;
  const id = parseIdSlug(idSlug);
  if (id === null) return {};
  try {
    const person = await getOrCreatePerson(id);
    return { title: `${person.name} — reco` };
  } catch {
    return {};
  }
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ idSlug: string }>;
}) {
  const { idSlug } = await params;
  const id = parseIdSlug(idSlug);
  if (id === null) notFound();

  let person;
  try {
    person = await getOrCreatePerson(id);
  } catch (e) {
    if (e instanceof TmdbError && e.status === 404) notFound();
    throw e;
  }

  const meta = (person.metadata ?? {}) as TmdbPersonDetail;
  const credits = filmography(meta.combined_credits);
  const facts = personFacts(meta);
  const photo = profileUrl(person.profilePath);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Dynamic dominant-color wash sampled from the profile photo */}
      <AmbientBackground colorSrc={photo} />
      {/* Hero: photo + name (no backdrop image for people) */}
      <HeroBackdrop backdropUrl={null}>
        <div className="flex flex-col gap-6 pt-16 sm:flex-row sm:items-end sm:pt-24">
          <div className="w-28 shrink-0 sm:w-40">
            <div className="aspect-2/3 overflow-hidden rounded-lg border border-border bg-surface-overlay shadow-overlay">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt={person.name}
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-text-muted">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-10 opacity-30"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <h1 className="text-2xl font-bold text-text sm:text-3xl">{person.name}</h1>
            {meta.known_for_department && (
              <p className="mt-1 text-sm text-text-muted">{meta.known_for_department}</p>
            )}
            {credits.length > 0 && (
              <p className="mt-2 text-sm text-text-muted">
                <span className="font-medium text-text">{credits.length}</span> titles
              </p>
            )}
          </div>
        </div>
      </HeroBackdrop>

      {/* Body: biography + filmography, facts sidebar */}
      <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0">
          {meta.biography ? (
            <p className="mb-8 leading-relaxed text-text-muted">{meta.biography}</p>
          ) : (
            <p className="mb-8 text-sm text-text-muted">No biography available.</p>
          )}

          <section>
            <h2 className="mb-4 text-lg font-semibold text-text">Filmography</h2>
            {credits.length > 0 ? (
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {credits.map((t) => (
                  <TitleCard
                    key={`${t.mediaType}-${t.tmdbId}`}
                    href={t.href}
                    title={t.title}
                    year={t.year}
                    posterUrl={t.posterUrl}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No known titles.</p>
            )}
          </section>
        </div>

        <FactsPanel facts={facts} />
      </div>
    </div>
  );
}
