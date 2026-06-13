import { notFound } from "next/navigation";
import { getOrCreateTitle } from "@/services/catalog";
import { TmdbError } from "@/lib/tmdb/client";
import { parseIdSlug, pickTrailerKey, topCast } from "@/lib/tmdb/detail";
import { posterUrl, backdropUrl } from "@/lib/tmdb/images";
import type { TmdbTitleDetail } from "@/lib/tmdb/types";
import { Badge } from "@/components/ui/Badge";
import { Rail } from "@/components/catalog/Rail";
import { PersonCard } from "@/components/catalog/PersonCard";
import { TrailerEmbed } from "@/components/catalog/TrailerEmbed";
import { WhereToWatch } from "@/components/catalog/WhereToWatch";

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
    return { title: `${row.title} — reco` };
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

  const genres = meta.genres ?? [];
  const runtime =
    mediaType === "movie"
      ? meta.runtime
      : (meta.episode_run_time?.[0] ?? undefined);
  const voteAverage = meta.vote_average;
  const cast = topCast(meta.credits?.cast);
  const trailerKey = pickTrailerKey(meta.videos?.results);
  const poster = posterUrl(title.posterPath);
  const backdrop = backdropUrl(title.backdropPath);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Backdrop banner */}
      {backdrop && (
        <div className="relative mb-8 h-56 w-full overflow-hidden rounded-xl border border-border sm:h-72 lg:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backdrop}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
        </div>
      )}

      {/* Header: poster + title block */}
      <div className="mb-8 flex gap-6">
        {poster && (
          <div className="w-32 shrink-0 sm:w-40">
            <div className="aspect-2/3 overflow-hidden rounded-lg border border-border">
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

        <div className="flex min-w-0 flex-col justify-end">
          <h1 className="text-2xl font-bold text-text sm:text-3xl">{title.title}</h1>
          {title.releaseYear && (
            <p className="mt-1 text-text-muted">{title.releaseYear}</p>
          )}

          {/* Badges: genres, runtime, rating */}
          <div className="mt-3 flex flex-wrap gap-2">
            {genres.map((g) => (
              <Badge key={g.id} variant="neutral">
                {g.name}
              </Badge>
            ))}
            {runtime != null && runtime > 0 && (
              <Badge variant="neutral">{runtime}m</Badge>
            )}
            {voteAverage != null && voteAverage > 0 && (
              <Badge variant="success">&#9733; {voteAverage.toFixed(1)}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Overview */}
      {title.overview && (
        <p className="mb-8 text-text-muted leading-relaxed">{title.overview}</p>
      )}

      {/* Trailer */}
      {trailerKey && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-text">Trailer</h2>
          <TrailerEmbed youtubeKey={trailerKey} />
        </div>
      )}

      {/* Where to watch — region hardcoded "US" for v1; Plan 3b will wire user's profile.region */}
      <WhereToWatch watch={meta["watch/providers"]} region="US" />

      {/* Cast rail */}
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
    </div>
  );
}
