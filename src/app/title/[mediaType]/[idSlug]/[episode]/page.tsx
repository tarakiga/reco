import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateTitle } from "@/services/catalog";
import { oneEpisode } from "@/services/tv-season";
import { parseIdSlug, parseEpisodeSlug } from "@/lib/tmdb/detail";
import { episodeCardFields } from "@/lib/tmdb/episode-card";
import { ShareButton } from "@/components/catalog/ShareButton";

interface Params {
  mediaType: string;
  idSlug: string;
  episode: string;
}

/** Show row, episode and parsed reference, or null when any part is unusable. */
async function load(params: Params) {
  if (params.mediaType !== "tv") return null;
  const id = parseIdSlug(params.idSlug);
  const ref = parseEpisodeSlug(params.episode);
  if (!id || !ref) return null;
  try {
    const show = await getOrCreateTitle("tv", id, false);
    const episode = await oneEpisode(id, ref.season, ref.episode);
    return episode ? { show, episode, ref } : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const p = await params;
  const data = await load(p);
  if (!data) return {};
  const { show, episode, ref } = data;
  const fields = episodeCardFields({
    showYear: show.releaseYear,
    season: ref.season,
    episode: ref.episode,
    airDate: episode.airDate,
    overview: episode.overview,
  });
  const title = `${show.title}: ${fields.metaLine} ${episode.name}`;
  const description = fields.synopsis ?? undefined;
  const ogImage = {
    url: `/title/tv/${p.idSlug}/${p.episode}/og`,
    width: 1200,
    height: 630,
    alt: title,
    type: "image/jpeg",
  };
  return {
    title,
    description,
    // One page per episode is a very large crawlable surface, so it stays out of
    // indexes. follow:true still lets a crawler walk back to the show page.
    robots: { index: false, follow: true },
    openGraph: { title, description, images: [ogImage], type: "video.episode" },
    twitter: { card: "summary_large_image", images: [ogImage.url] },
  };
}

export default async function EpisodePage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const data = await load(p);
  if (!data) notFound();
  const { show, episode, ref } = data;
  const fields = episodeCardFields({
    showYear: show.releaseYear,
    season: ref.season,
    episode: ref.episode,
    airDate: episode.airDate,
    overview: episode.overview,
  });
  const showHref = `/title/tv/${show.tmdbId}-${show.slug}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={showHref} className="text-sm font-medium text-accent-text hover:underline">
        {show.title}
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-text-muted">
            Season {ref.season}, Episode {ref.episode}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-text sm:text-3xl">{episode.name}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {[fields.year ? String(fields.year) : null, episode.runtime ? `${episode.runtime} min` : null]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
        </div>
        <ShareButton title={`${show.title}: ${episode.name}`} />
      </div>

      {episode.stillUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={episode.stillUrl}
          alt=""
          className="mt-6 w-full rounded-lg border border-border object-cover"
        />
      ) : null}

      {episode.overview ? (
        <p className="mt-6 text-text-muted">{episode.overview}</p>
      ) : null}

      <p className="mt-8">
        <Link href={`${showHref}#s${ref.season}e${ref.episode}`} className="text-sm text-accent-text hover:underline">
          See this episode in the full season list
        </Link>
      </p>
    </div>
  );
}
