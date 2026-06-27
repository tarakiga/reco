import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/services/profile";
import { challengeProgress } from "@/services/challenges";
import { getChallenge } from "@/lib/challenges";
import { cardActionContext, favouriteProp, watchlistProp } from "@/services/favourites";
import { CompletionBar } from "@/components/completion/CompletionBar";
import { TitleCard } from "@/components/catalog/TitleCard";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getChallenge(slug);
  return { title: c ? c.name : "Challenge" };
}

export default async function ChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const profile = await getCurrentProfile();
  const [p, ctx] = await Promise.all([challengeProgress(profile?.id ?? null, slug), cardActionContext()]);
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden>{p.challenge.emoji}</span>
        <h1 className="text-2xl font-bold text-text">{p.challenge.name}</h1>
      </div>
      <p className="mb-4 text-text-muted">{p.challenge.blurb}</p>
      <div className="mb-8 max-w-md">
        <CompletionBar label="Progress" watched={p.watched} total={p.total} />
      </div>

      {p.remaining.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-text">To watch ({p.remaining.length})</h2>
          <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {p.remaining.map((t) => (
              <TitleCard
                key={t.tmdbId}
                href={t.href}
                title={t.title}
                year={t.year}
                posterUrl={t.posterUrl}
                favourite={favouriteProp(ctx, t.mediaType, t.tmdbId)}
                watchlist={watchlistProp(ctx, t.mediaType, t.tmdbId)}
              />
            ))}
          </div>
        </>
      )}

      {p.seen.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-text">Seen ({p.seen.length})</h2>
          <div className="grid grid-cols-3 gap-3 opacity-80 sm:grid-cols-4 md:grid-cols-6">
            {p.seen.map((t) => (
              <TitleCard
                key={t.tmdbId}
                href={t.href}
                title={t.title}
                year={t.year}
                posterUrl={t.posterUrl}
                favourite={favouriteProp(ctx, t.mediaType, t.tmdbId)}
                watchlist={watchlistProp(ctx, t.mediaType, t.tmdbId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
