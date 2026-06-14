import { notFound } from "next/navigation";
import { after } from "next/server";
import { getOrCreateTitle } from "@/services/catalog";
import { onTitleViewed } from "@/services/taste-hooks";
import { TmdbError } from "@/lib/tmdb/client";
import {
  parseIdSlug,
  pickTrailerKey,
  topCast,
  keyCrew,
  certification,
  recommendations,
  formatRuntime,
  titleFacts,
} from "@/lib/tmdb/detail";
import { posterUrl, posterUrlSmall, backdropUrl } from "@/lib/tmdb/images";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { Badge } from "@/components/ui/Badge";
import { Rail } from "@/components/catalog/Rail";
import { PersonCard } from "@/components/catalog/PersonCard";
import { TitleCard } from "@/components/catalog/TitleCard";
import { TrailerEmbed } from "@/components/catalog/TrailerEmbed";
import { WhereToWatchClient } from "@/components/catalog/WhereToWatchClient";
import { TitleActions } from "@/components/catalog/TitleActions";
import { HeroBackdrop } from "@/components/catalog/HeroBackdrop";
import { AmbientBackground } from "@/components/catalog/AmbientBackground";
import { FactsPanel } from "@/components/catalog/FactsPanel";
import { SeasonsAccordion } from "@/components/catalog/SeasonsAccordion";
import { EpisodeFinder } from "@/components/catalog/EpisodeFinder";
import { seasonSummaries } from "@/lib/tmdb/episodes";
import { TitleMatch } from "@/components/catalog/TitleMatch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mediaType: string; idSlug: string }>;
}) {
  const { mediaType, idSlug } = await params;
  const id = parseIdSlug(idSlug);
  if (!id) return {};
  if (mediaType !== "movie" && mediaType !== "tv") return {};
  try {
    const row = await getOrCreateTitle(mediaType, id);
    const description = row.overview ? row.overview.slice(0, 200) : undefined;
    const images = [backdropUrl(row.backdropPath), posterUrl(row.posterPath)].filter(
      (u): u is string => Boolean(u),
    );
    return {
      title: row.title,
      description,
      openGraph: {
        title: row.title,
        description,
        images,
        type: "video.other",
      },
    };
  } catch {
    return {};
  }
}

export default async function TitlePage({
  params,
}: {
  params: Promise<{ mediaType: string; idSlug: string }>;
}) {
  const { mediaType, idSlug } = await params;

  if (mediaType !== "movie" && mediaType !== "tv") notFound();

  const id = parseIdSlug(idSlug);
  if (!id) notFound();

  let title;
  try {
    title = await getOrCreateTitle(mediaType, id);
  } catch (e) {
    if (e instanceof TmdbError && e.status === 404) notFound();
    throw e;
  }

  const meta = (title.metadata ?? {}) as TmdbTitleDetail;

  after(() => onTitleViewed(title.id));

  const genres = meta.genres ?? [];
  const runtime = formatRuntime(
    mediaType === "movie" ? meta.runtime : meta.episode_run_time?.[0],
  );
  const cert = certification(meta, mediaType);
  const crew = keyCrew(meta, mediaType);
  const cast = topCast(meta.credits?.cast);
  const trailerKey = pickTrailerKey(meta.videos?.results);
  const recs = recommendations(meta);
  const seasons = mediaType === "tv" ? seasonSummaries(meta) : [];
  const facts = titleFacts(meta, mediaType);
  const voteAverage = meta.vote_average;
  const voteCount = meta.vote_count;
  const poster = posterUrl(title.posterPath);
  const colorSrc = posterUrlSmall(title.posterPath);
  const backdrop = backdropUrl(title.backdropPath);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Dynamic dominant-color wash across the page background */}
      <AmbientBackground colorSrc={colorSrc} />
      {/* Cinematic hero: backdrop image with poster + title block */}
      <HeroBackdrop backdropUrl={backdrop}>
        <div className="flex flex-col gap-6 pt-28 sm:flex-row sm:items-end sm:pt-40">
          {poster && (
            <div className="w-28 shrink-0 sm:w-40">
              <div className="aspect-2/3 overflow-hidden rounded-lg border border-border shadow-overlay">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={poster}
                  alt={title.title}
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-col">
            <h1 className="text-2xl font-bold text-text sm:text-3xl">{title.title}</h1>
            {meta.tagline && (
              <p className="mt-1 text-sm italic text-text-muted sm:text-base">{meta.tagline}</p>
            )}

            {/* Meta row: year · runtime · rating · age rating */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-text">
              {title.releaseYear && <span>{title.releaseYear}</span>}
              {runtime && (
                <>
                  <span className="text-text-muted">·</span>
                  <span>{runtime}</span>
                </>
              )}
              {voteAverage != null && voteAverage > 0 && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className="font-medium text-warning">&#9733; {voteAverage.toFixed(1)}</span>
                  {voteCount != null && voteCount > 0 && (
                    <span className="text-xs text-text-muted">({voteCount.toLocaleString("en-US")})</span>
                  )}
                </>
              )}
              <TitleMatch titleId={title.id} />
              {cert && (
                <span className="rounded border border-border px-1.5 py-0.5 text-xs text-text-muted">
                  {cert}
                </span>
              )}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {genres.map((g) => (
                  <Badge key={g.id} variant="neutral">
                    {g.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Key crew */}
            {crew.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {crew.map((c) => (
                  <span key={c.role}>
                    <span className="text-text-muted">{c.role}</span>{" "}
                    <span className="text-text">{c.names.join(", ")}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </HeroBackdrop>

      {/* Body: main column + facts sidebar */}
      <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0">
          {/* Watchlist + rating (client island) */}
          <div className="mb-8">
            <TitleActions mediaType={mediaType} tmdbId={id} />
          </div>

          {title.overview && (
            <p className="mb-8 leading-relaxed text-text-muted">{title.overview}</p>
          )}

          {trailerKey && (
            <div className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-text">Trailer</h2>
              <TrailerEmbed youtubeKey={trailerKey} />
            </div>
          )}

          {/* Where to watch — client island resolves user's region (US default) */}
          <WhereToWatchClient watch={meta["watch/providers"]} />

          {seasons.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-text">Episodes</h2>
              <EpisodeFinder tvId={id} />
              <SeasonsAccordion tvId={id} seasons={seasons} />
            </section>
          )}

          {cast.length > 0 && (
            <Rail title="Cast">
              {cast.map((member) => (
                <div key={member.tmdbId} className="w-28 shrink-0">
                  <PersonCard
                    href={member.href}
                    name={member.name}
                    profileUrl={member.profileUrl}
                    subtitle={member.character ?? undefined}
                  />
                </div>
              ))}
            </Rail>
          )}

          {recs.length > 0 && (
            <Rail title="More like this">
              {recs.map((r) => (
                <div key={`${r.mediaType}-${r.tmdbId}`} className="w-28 shrink-0">
                  <TitleCard href={r.href} title={r.title} year={r.year} posterUrl={r.posterUrl} />
                </div>
              ))}
            </Rail>
          )}
        </div>

        <FactsPanel facts={facts} />
      </div>
    </div>
  );
}
