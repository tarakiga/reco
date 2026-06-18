import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getOrCreatePerson } from "@/services/catalog";
import { getCurrentProfile } from "@/services/profile";
import { watchedTitleKeys } from "@/services/completion";
import { TmdbError } from "@/lib/tmdb/client";
import { parseIdSlug } from "@/lib/tmdb/detail";
import { profileUrl, profileUrlSmall } from "@/lib/tmdb/images";
import { filmography, personFacts } from "@/lib/tmdb/person";
import type { TmdbPersonDetail } from "@/lib/tmdb/types";
import { FilmographyGrid } from "@/components/person/FilmographyGrid";
import { PersonCompletion } from "@/components/person/PersonCompletion";
import { ShareButton } from "@/components/catalog/ShareButton";
import { PersonAwards } from "@/components/person/PersonAwards";
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
    const person = await getOrCreatePerson(id, false);
    const meta = (person.metadata ?? {}) as TmdbPersonDetail;
    const description = meta.biography ? meta.biography.slice(0, 200) : undefined;
    const image = profileUrl(person.profilePath);
    return {
      title: person.name,
      description,
      openGraph: {
        title: person.name,
        description,
        images: image ? [image] : undefined,
        type: "profile",
      },
    };
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

  // Only persist on signed-in views so an anonymous crawler walking /person/[id]
  // can't grow the catalog. The same profile gates the "seen" markers below.
  const profile = await getCurrentProfile();
  let person;
  try {
    person = await getOrCreatePerson(id, Boolean(profile));
  } catch (e) {
    if (e instanceof TmdbError && e.status === 404) notFound();
    throw e;
  }

  const meta = (person.metadata ?? {}) as TmdbPersonDetail;
  const credits = filmography(meta.combined_credits);
  const facts = personFacts(meta);

  // Per-user "seen" markers for the filmography + completion bars.
  const watched = profile ? await watchedTitleKeys(profile.id) : new Set<string>();
  const years = credits.map((c) => c.year).filter((y): y is number => y != null);
  if (years.length > 0) {
    const min = Math.min(...years);
    const max = Math.max(...years);
    facts.push({ label: "Active", value: min === max ? `${min}` : `${min}–${max}` });
  }
  const photo = profileUrl(person.profilePath);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Dynamic dominant-color wash sampled from the profile photo */}
      <AmbientBackground colorSrc={profileUrlSmall(person.profilePath)} />
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

            <div className="mt-4">
              <ShareButton title={person.name} />
            </div>
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

          {profile && (
            <Suspense fallback={null}>
              <PersonCompletion personId={id} watched={watched} />
            </Suspense>
          )}

          <section>
            <h2 className="mb-4 text-lg font-semibold text-text">Filmography</h2>
            {credits.length > 0 ? (
              <FilmographyGrid personId={id} credits={credits} watchedKeys={[...watched]} />
            ) : (
              <p className="text-sm text-text-muted">No known titles.</p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <FactsPanel facts={facts} />
          <Suspense fallback={null}>
            <PersonAwards personId={id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
